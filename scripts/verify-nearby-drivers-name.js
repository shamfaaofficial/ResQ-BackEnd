
// Mock driver data
const driver = {
    _id: 'driver123',
    userId: {
        profile: {
            firstName: 'John',
            lastName: 'Doe'
        }
    },
    vehicleDetails: {
        vehicleNumber: 'ABC-123'
    },
    rating: {
        average: 4.5,
        totalRatings: 10
    }
};

const driverNoLastName = {
    _id: 'driver456',
    userId: {
        profile: {
            firstName: 'Jane'
        }
    },
    vehicleDetails: {
        vehicleNumber: 'XYZ-789'
    },
    rating: {
        average: 4.8,
        totalRatings: 5
    }
};

const driverNoProfile = {
    _id: 'driver789',
    userId: {
        // profile missing
    },
    vehicleDetails: {
        vehicleNumber: 'DEF-456'
    },
    rating: {
        average: 4.0,
        totalRatings: 2
    }
};

// Logic from controller
const mapDriver = (driver) => {
    return {
        id: driver._id,
        vehicleNumber: driver.vehicleDetails?.vehicleNumber,
        rating: driver.rating?.average || 0,
        totalRatings: driver.rating?.totalRatings || 0,
        name: driver.userId?.profile?.firstName
            ? `${driver.userId.profile.firstName} ${driver.userId.profile.lastName || ''}`.trim()
            : 'Driver'
    };
};

console.log('Testing Driver 1 (Full Name):');
console.log(mapDriver(driver));

console.log('\nTesting Driver 2 (No Last Name):');
console.log(mapDriver(driverNoLastName));

console.log('\nTesting Driver 3 (No Profile):');
console.log(mapDriver(driverNoProfile));
