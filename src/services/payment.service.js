const axios = require('axios');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const { BOOKING_STATUS, PAYMENT_STATUS, TRANSACTION_TYPE } = require('../config/constants');

class MyFatoorahPaymentService {
  constructor() {
    this.apiKey = process.env.AL_FATOORAH_API_KEY;
    this.baseURL = process.env.AL_FATOORAH_BASE_URL || 'https://apitest.myfatoorah.com';
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Initiate payment and get payment URL for user
   */
  async initiatePayment(booking, user) {
    try {
      const callbackUrl = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/v1/payment/callback`;
      const errorUrl = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/api/v1/payment/error`;

      const payload = {
        NotificationOption: 'LNK',
        InvoiceValue: booking.pricing.totalAmount,
        CustomerName: user.profile?.firstName || user.phoneNumber,
        CustomerMobile: user.phoneNumber.replace('+974', ''),
        CustomerEmail: user.email || '',
        CallBackUrl: callbackUrl,
        ErrorUrl: errorUrl,
        Language: 'en',
        DisplayCurrencyIso: 'QAR',
        MobileCountryCode: '+974',
        CustomerReference: booking._id.toString(),
        UserDefinedField: booking.bookingNumber
      };

      console.log('🔄 Initiating MyFatoorah payment:', payload);

      const response = await axios.post(
        `${this.baseURL}/v2/SendPayment`,
        payload,
        { headers: this.getHeaders() }
      );

      console.log('✅ MyFatoorah response:', response.data);

      if (response.data.IsSuccess) {
        return {
          success: true,
          paymentUrl: response.data.Data.InvoiceURL,
          invoiceId: response.data.Data.InvoiceId,
          paymentId: response.data.Data.PaymentURL
        };
      } else {
        throw new Error(response.data.Message || 'Payment initiation failed');
      }
    } catch (error) {
      console.error('❌ MyFatoorah payment initiation error:', error.response?.data || error.message);
      throw new Error(`Payment initiation failed: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Check payment status from MyFatoorah
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/GetPaymentStatus`,
        {
          KeyType: 'PaymentId',
          Key: paymentId
        },
        { headers: this.getHeaders() }
      );

      if (response.data.IsSuccess) {
        const paymentData = response.data.Data;
        return {
          success: true,
          status: paymentData.InvoiceStatus,
          transactionId: paymentData.InvoiceTransactions?.[0]?.TransactionId,
          paidAmount: paymentData.InvoiceValue,
          paymentDate: paymentData.InvoiceTransactions?.[0]?.TransactionDate,
          paymentMethod: paymentData.InvoiceTransactions?.[0]?.PaymentGateway,
          customerReference: paymentData.CustomerReference,
          isPaid: paymentData.InvoiceStatus === 'Paid'
        };
      } else {
        return {
          success: false,
          message: response.data.Message
        };
      }
    } catch (error) {
      console.error('❌ MyFatoorah payment status check error:', error.response?.data || error.message);
      throw new Error(`Payment status check failed: ${error.response?.data?.Message || error.message}`);
    }
  }

  /**
   * Process payment callback and update booking
   */
  async processPaymentCallback(paymentId) {
    try {
      // Get payment status from MyFatoorah
      const paymentStatus = await this.getPaymentStatus(paymentId);

      if (!paymentStatus.success) {
        return {
          success: false,
          message: 'Payment verification failed'
        };
      }

      // Find booking by customer reference
      const booking = await Booking.findById(paymentStatus.customerReference);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check if payment is successful
      if (paymentStatus.isPaid && paymentStatus.status === 'Paid') {
        // Update booking payment status
        booking.payment = {
          status: PAYMENT_STATUS.COMPLETED,
          method: paymentStatus.paymentMethod,
          transactionId: paymentStatus.transactionId,
          paidAmount: paymentStatus.paidAmount,
          paidAt: new Date(paymentStatus.paymentDate),
          gateway: 'MyFatoorah',
          gatewayResponse: paymentStatus
        };
        booking.status = BOOKING_STATUS.PAYMENT_COMPLETED;
        booking.timeline.paymentCompletedAt = new Date();
        await booking.save();

        // Create transaction record
        await Transaction.create({
          transactionId: paymentStatus.transactionId,
          bookingId: booking._id,
          userId: booking.userId,
          driverId: booking.driverId,
          type: TRANSACTION_TYPE.BOOKING_PAYMENT,
          amount: paymentStatus.paidAmount,
          status: 'completed',
          paymentMethod: paymentStatus.paymentMethod,
          gateway: 'MyFatoorah',
          gatewayTransactionId: paymentStatus.transactionId,
          description: `Payment for booking ${booking.bookingNumber}`
        });

        console.log(`✅ Payment successful for booking ${booking.bookingNumber}`);

        return {
          success: true,
          message: 'Payment completed successfully',
          booking
        };
      } else {
        // Payment failed or pending
        booking.payment = {
          status: PAYMENT_STATUS.FAILED,
          method: paymentStatus.paymentMethod || 'Unknown',
          gatewayResponse: paymentStatus
        };
        await booking.save();

        return {
          success: false,
          message: 'Payment failed or incomplete',
          status: paymentStatus.status
        };
      }
    } catch (error) {
      console.error('❌ Payment callback processing error:', error.message);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(booking, refundAmount, reason) {
    try {
      if (!booking.payment?.transactionId) {
        throw new Error('No payment transaction found for this booking');
      }

      const response = await axios.post(
        `${this.baseURL}/v2/MakeRefund`,
        {
          KeyType: 'PaymentId',
          Key: booking.payment.transactionId,
          RefundChargeOnCustomer: false,
          ServiceChargeOnCustomer: false,
          Amount: refundAmount,
          Comment: reason || 'Booking cancellation refund'
        },
        { headers: this.getHeaders() }
      );

      if (response.data.IsSuccess) {
        // Update booking payment status
        booking.payment.refundStatus = 'completed';
        booking.payment.refundAmount = refundAmount;
        booking.payment.refundDate = new Date();
        await booking.save();

        // Create refund transaction
        await Transaction.create({
          transactionId: `REFUND-${Date.now()}`,
          bookingId: booking._id,
          userId: booking.userId,
          type: TRANSACTION_TYPE.REFUND,
          amount: refundAmount,
          status: 'completed',
          description: `Refund for booking ${booking.bookingNumber}: ${reason}`
        });

        return {
          success: true,
          message: 'Refund processed successfully'
        };
      } else {
        throw new Error(response.data.Message || 'Refund failed');
      }
    } catch (error) {
      console.error('❌ Refund error:', error.response?.data || error.message);
      throw new Error(`Refund failed: ${error.response?.data?.Message || error.message}`);
    }
  }
}

module.exports = new MyFatoorahPaymentService();
