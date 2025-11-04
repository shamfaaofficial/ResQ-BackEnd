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
   */
  async getDistanceBetweenPoints(origin, destination) {
    try {
      const result = await googleMaps.calculateDistance(origin, destination);

      if (result.status === 'OK' && result.rows.length > 0) {
        const element = result.rows[0].elements[0];

        if (element.status === 'OK') {
          return {
            distance: element.distance.value / 1000, // Convert meters to kilometers
            distanceText: element.distance.text,
            duration: element.duration.value, // in seconds
            durationText: element.duration.text
          };
        }
      }

      throw new Error('Could not calculate distance');
    } catch (error) {
      // Fallback to Haversine formula if Google Maps fails
      console.warn('Google Maps distance calculation failed, using Haversine formula');
      const distance = calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      return {
        distance,
        distanceText: `${distance} km`,
        duration: null,
        durationText: 'N/A'
      };
    }
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
   */
  async calculateDriverToPickupDistance(driverLocation, pickupLocation) {
    try {
      const result = await googleMaps.calculateDistance(
        { latitude: driverLocation.coordinates[1], longitude: driverLocation.coordinates[0] },
        { latitude: pickupLocation.coordinates[1], longitude: pickupLocation.coordinates[0] }
      );

      if (result.status === 'OK' && result.rows.length > 0) {
        const element = result.rows[0].elements[0];

        if (element.status === 'OK') {
          return {
            distance: element.distance.value / 1000, // km
            distanceText: element.distance.text,
            duration: Math.ceil(element.duration.value / 60), // minutes
            durationText: element.duration.text
          };
        }
      }

      throw new Error('Could not calculate distance');
    } catch (error) {
      throw new Error(`Driver to pickup distance calculation failed: ${error.message}`);
    }
  }

  /**
   * Calculate route details between pickup and dropoff using Directions API
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
      throw new Error(`Trip route calculation failed: ${error.message}`);
    }
  }
}

module.exports = new MapsService();
