const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseURL = 'https://maps.googleapis.com/maps/api';
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      console.warn('⚠️  GOOGLE_MAPS_API_KEY not configured. Google Maps services will not be available.');
      console.warn('⚠️  Distance calculations will fall back to Haversine formula (straight-line distance).');
    } else {
      console.log('✅ Google Maps API configured successfully');
    }
  }

  /**
   * Check if Google Maps is properly configured
   */
  isAvailable() {
    return this.isConfigured;
  }

  async geocode(address) {
    if (!this.isConfigured) {
      throw new Error('Google Maps API key not configured');
    }
    try {
      const response = await axios.get(`${this.baseURL}/geocode/json`, {
        params: {
          address,
          key: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  async reverseGeocode(latitude, longitude) {
    if (!this.isConfigured) {
      throw new Error('Google Maps API key not configured');
    }
    try {
      const response = await axios.get(`${this.baseURL}/geocode/json`, {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Reverse geocoding failed: ${error.message}`);
    }
  }

  async calculateDistance(origin, destination) {
    if (!this.isConfigured) {
      throw new Error('Google Maps API key not configured');
    }
    try {
      const response = await axios.get(`${this.baseURL}/distancematrix/json`, {
        params: {
          origins: `${origin.latitude},${origin.longitude}`,
          destinations: `${destination.latitude},${destination.longitude}`,
          key: this.apiKey
        }
      });

      // Check if Google Maps returned an error
      if (response.data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${response.data.status} - ${response.data.error_message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      // Log detailed error for debugging
      console.error('[GoogleMaps] Distance calculation error:', error.response?.data || error.message);
      throw new Error(`Distance calculation failed: ${error.message}`);
    }
  }

  async getPlaceDetails(placeId) {
    if (!this.isConfigured) {
      throw new Error('Google Maps API key not configured');
    }
    try {
      const response = await axios.get(`${this.baseURL}/place/details/json`, {
        params: {
          place_id: placeId,
          key: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Place details fetch failed: ${error.message}`);
    }
  }

  async getDirections(origin, destination) {
    if (!this.isConfigured) {
      throw new Error('Google Maps API key not configured');
    }
    try {
      const response = await axios.get(`${this.baseURL}/directions/json`, {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          key: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Directions fetch failed: ${error.message}`);
    }
  }
}

module.exports = new GoogleMapsService();
