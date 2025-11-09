const googleMaps = require('../config/googleMaps');
const { calculateDistance } = require('../utils/helpers');

class MapsService {
  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address) {
    try {
      const result = await googleMaps.geocode(address);

      if (result.status === 'OK' && result.results.length > 0) {
        const location = result.results[0].geometry.location;
        return {
          latitude: location.lat,
          longitude: location.lng,
          formattedAddress: result.results[0].formatted_address,
          placeId: result.results[0].place_id
        };
      }

      throw new Error('Address not found');
    } catch (error) {
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(latitude, longitude) {
    try {
      const result = await googleMaps.reverseGeocode(latitude, longitude);

      if (result.status === 'OK' && result.results.length > 0) {
        return {
          address: result.results[0].formatted_address,
          placeId: result.results[0].place_id,
          addressComponents: result.results[0].address_components
        };
      }

      throw new Error('Location not found');
    } catch (error) {
      throw new Error(`Reverse geocoding failed: ${error.message}`);
    }
  }

  /**
   * Calculate distance between two points using Google Maps API
   * This is the main method with fallback to Haversine formula
   */
  async calculateDistance(origin, destination) {
    try {
      const result = await googleMaps.calculateDistance(origin, destination);

      if (result.status === 'OK' && result.rows.length > 0) {
        const element = result.rows[0].elements[0];

        if (element.status === 'OK') {
          return {
            distance: element.distance.value, // in meters
            distanceText: element.distance.text,
            duration: element.duration.value, // in seconds
            durationText: element.duration.text
          };
        }
      }

      throw new Error('Could not calculate distance');
    } catch (error) {
      // Fallback to Haversine formula if Google Maps fails
      console.warn('Google Maps distance calculation failed, using Haversine formula:', error.message);
      const distance = calculateDistance(
        origin.latitude || origin.lat,
        origin.longitude || origin.lng,
        destination.latitude || destination.lat,
        destination.longitude || destination.lng
      );

      return {
        distance: distance * 1000, // convert km to meters for consistency
        distanceText: `${distance.toFixed(2)} km`,
        duration: null,
        durationText: 'N/A'
      };
    }
  }

  /**
   * Calculate distance between two points using Google Maps API
   * @deprecated Use calculateDistance instead
   */
  async getDistanceBetweenPoints(origin, destination) {
    return this.calculateDistance(origin, destination);
  }

  /**
   * Calculate distance using Haversine formula (fallback)
   */
  calculateStraightLineDistance(lat1, lon1, lat2, lon2) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }

  /**
   * Find nearby drivers within radius
   */
  async findNearbyDrivers(location, radius, drivers) {
    const nearbyDrivers = [];

    for (const driver of drivers) {
      if (!driver.currentLocation || !driver.currentLocation.coordinates) {
        continue;
      }

      const [driverLng, driverLat] = driver.currentLocation.coordinates;

      // Calculate distance
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        driverLat,
        driverLng
      );

      if (distance <= radius) {
        nearbyDrivers.push({
          driver,
          distance,
          location: {
            latitude: driverLat,
            longitude: driverLng,
            address: driver.currentLocation.address
          }
        });
      }
    }

    // Sort by distance
    nearbyDrivers.sort((a, b) => a.distance - b.distance);

    return nearbyDrivers;
  }

  /**
   * Validate coordinates
   */
  isValidCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId) {
    try {
      const result = await googleMaps.getPlaceDetails(placeId);

      if (result.status === 'OK') {
        return result.result;
      }

      throw new Error('Place not found');
    } catch (error) {
      throw new Error(`Failed to get place details: ${error.message}`);
    }
  }

  /**
   * Calculate distance and time between driver location and pickup using Distance Matrix API
   * Falls back to Haversine formula if Google Maps API fails
   */
  async calculateDriverToPickupDistance(driverLocation, pickupLocation) {
    try {
      // Use the main calculateDistance method which has fallback
      const result = await this.calculateDistance(
        { latitude: driverLocation.coordinates[1], longitude: driverLocation.coordinates[0] },
        { latitude: pickupLocation.coordinates[1], longitude: pickupLocation.coordinates[0] }
      );

      return {
        distance: result.distance / 1000, // convert meters to km
        distanceText: result.distanceText,
        duration: result.duration ? Math.ceil(result.duration / 60) : null, // convert seconds to minutes
        durationText: result.durationText
      };
    } catch (error) {
      // Final fallback - use Haversine directly
      console.error('All distance calculation methods failed:', error.message);
      const distance = calculateDistance(
        driverLocation.coordinates[1],
        driverLocation.coordinates[0],
        pickupLocation.coordinates[1],
        pickupLocation.coordinates[0]
      );

      return {
        distance: distance, // already in km
        distanceText: `${distance.toFixed(2)} km`,
        duration: null,
        durationText: 'N/A'
      };
    }
  }

  /**
   * Calculate route details between pickup and dropoff using Directions API
   * Falls back to Distance Matrix API and then Haversine if Directions API fails
   */
  async calculateTripRoute(pickupLocation, dropoffLocation) {
    try {
      const result = await googleMaps.getDirections(
        { latitude: pickupLocation.coordinates[1], longitude: pickupLocation.coordinates[0] },
        { latitude: dropoffLocation.coordinates[1], longitude: dropoffLocation.coordinates[0] }
      );

      if (result.status === 'OK' && result.routes.length > 0) {
        const route = result.routes[0];
        const leg = route.legs[0];

        return {
          distance: leg.distance.value / 1000, // km
          distanceText: leg.distance.text,
          duration: Math.ceil(leg.duration.value / 60), // minutes
          durationText: leg.duration.text,
          polyline: route.overview_polyline.points
        };
      }

      throw new Error('Could not calculate route');
    } catch (error) {
      // Fallback to Distance Matrix API
      console.warn('Directions API failed, falling back to Distance Matrix:', error.message);
      try {
        const result = await this.calculateDistance(
          { latitude: pickupLocation.coordinates[1], longitude: pickupLocation.coordinates[0] },
          { latitude: dropoffLocation.coordinates[1], longitude: dropoffLocation.coordinates[0] }
        );

        return {
          distance: result.distance / 1000, // convert meters to km
          distanceText: result.distanceText,
          duration: result.duration ? Math.ceil(result.duration / 60) : null, // convert seconds to minutes
          durationText: result.durationText,
          polyline: null // No polyline available from Distance Matrix
        };
      } catch (fallbackError) {
        // Final fallback - use Haversine directly
        console.error('All route calculation methods failed:', fallbackError.message);
        const distance = calculateDistance(
          pickupLocation.coordinates[1],
          pickupLocation.coordinates[0],
          dropoffLocation.coordinates[1],
          dropoffLocation.coordinates[0]
        );

        return {
          distance: distance, // already in km
          distanceText: `${distance.toFixed(2)} km`,
          duration: null,
          durationText: 'N/A',
          polyline: null
        };
      }
    }
  }
}

module.exports = new MapsService();
