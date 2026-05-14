const { errorResponse } = require('../utils/responseHelper');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Error validasi
    if (err.name === 'ValidationError') {
        return errorResponse(res, err.message, 400);
    }

    // Error duplicate entry (email sudah terdaftar)
    if (err.code === 'ER_DUP_ENTRY') {
        return errorResponse(res, 'Email sudah terdaftar.', 409);
    }

    // Error default
    return errorResponse(res, err.message || 'Terjadi kesalahan pada server.', 500);
};

module.exports = { errorHandler };
