// Helper untuk response sukses
const successResponse = (res, data, message = 'Sukses', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message: message,
        data: data
    });
};

// Helper untuk response error
const errorResponse = (res, message = 'Terjadi kesalahan', statusCode = 400) => {
    return res.status(statusCode).json({
        success: false,
        message: message,
        data: null
    });
};

module.exports = { successResponse, errorResponse };
