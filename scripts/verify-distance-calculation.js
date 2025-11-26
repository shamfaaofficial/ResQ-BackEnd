// Test distance calculation logic
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const toRad = (value) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(2));
};

// Test data: User location and driver locations
const userLat = 25.2854;
const userLng = 51.5310;

const drivers = [
    {
        _id: 'driver1',
        name: 'John Doe',
        location: {
            lat: 25.2900,
            lng: 51.5350
        }
    },
    {
        _id: 'driver2',
        name: 'Jane Smith',
        location: {
            lat: 25.3000,
            lng: 51.5500
        }
    },
    {
        _id: 'driver3',
        name: 'Bob Wilson',
        location: {
            lat: 25.2800,
            lng: 51.5280
        }
    }
];

console.log('User Location:', { lat: userLat, lng: userLng });
console.log('\nCalculating distances to drivers:\n');

drivers.forEach(driver => {
    const distanceKm = calculateDistance(
        userLat,
        userLng,
        driver.location.lat,
        driver.location.lng
    );

    console.log(`${driver.name}:`);
    console.log(`  Location: [${driver.location.lat}, ${driver.location.lng}]`);
    console.log(`  Distance: ${distanceKm} km\n`);
});

// Test Redis distance conversion (meters to km)
console.log('Testing Redis distance conversion:');
const redisDistanceMeters = 1500; // 1.5 km
const redisDistanceKm = parseFloat((redisDistanceMeters / 1000).toFixed(2));
console.log(`Redis distance: ${redisDistanceMeters}m = ${redisDistanceKm} km`);
