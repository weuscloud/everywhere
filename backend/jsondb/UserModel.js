// userModel.js
const userModel = {
    name: { required: true, regex: /^[a-zA-Z0-9_]{6,12}$/, unique: true },
    password: { required: true, regex: /^[a-zA-Z0-9.,@$!%*?&]{8,16}$/},
    avatarURL: {
        required: false,
        regex: /^(https?):\/\/[^\s/$.?#].[^\s]*$|^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/,
        default: 'https://www.example.com/user.png',
    },
    is2FAEnabled: {
        type: 'boolean',
        required: false,
        default: false
    }
};

module.exports = userModel;