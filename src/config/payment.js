const axios = require('axios');

class AlFatoorahPaymentService {
  constructor() {
    this.apiKey = process.env.AL_FATOORAH_API_KEY;
    this.baseURL = process.env.AL_FATOORAH_BASE_URL;
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async initiatePayment(data) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/SendPayment`,
        {
          NotificationOption: 'LNK',
          InvoiceValue: data.amount,
          CustomerName: data.customerName,
          CustomerMobile: data.customerMobile,
          CustomerEmail: data.customerEmail || '',
          CallBackUrl: process.env.AL_FATOORAH_SUCCESS_URL,
          ErrorUrl: process.env.AL_FATOORAH_ERROR_URL,
          Language: 'en',
          DisplayCurrencyIso: 'QAR',
          MobileCountryCode: '+974',
          CustomerReference: data.bookingId,
          UserDefinedField: data.bookingId
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Payment initiation failed: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/GetPaymentStatus`,
        { KeyType: 'PaymentId', Key: paymentId },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Payment status check failed: ${error.message}`);
    }
  }

  async executePayment(paymentMethodId, invoiceValue, customerReference) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/ExecutePayment`,
        {
          PaymentMethodId: paymentMethodId,
          InvoiceValue: invoiceValue,
          CustomerReference: customerReference
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Payment execution failed: ${error.message}`);
    }
  }

  async refundPayment(paymentId, refundAmount, reason) {
    try {
      const response = await axios.post(
        `${this.baseURL}/v2/MakeRefund`,
        {
          KeyType: 'PaymentId',
          Key: paymentId,
          RefundChargeOnCustomer: false,
          ServiceChargeOnCustomer: false,
          Amount: refundAmount,
          Comment: reason
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Refund failed: ${error.message}`);
    }
  }
}

module.exports = new AlFatoorahPaymentService();
