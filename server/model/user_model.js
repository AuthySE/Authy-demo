var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var UserSchema = new Schema({
    username: {type: String, required: true, unique: true},
    email: {type: String, required: true},
    
    authyId: String,
    hashed_password: String
});

mongoose.model('User', UserSchema);

