const axios = require('axios');

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseURL = 'https://maps.googleapis.com/maps/api';
  }

  async geocode(address) {
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
    try {
      const response = await axios.get(`${this.baseURL}/distancematrix/json`, {
        params: {
          origins: `${origin.latitude},${origin.longitude}`,
          destinations: `${destination.latitude},${destination.longitude}`,
          key: this.apiKey
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Distance calculation failed: ${error.message}`);
    }
  }

  async getPlaceDetails(placeId) {
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
}

module.exports = new GoogleMapsService();
