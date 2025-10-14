import mongoose , { Schema, Document } from 'mongoose';
export interface User extends Document {
            username: string;
            email: string;
            password: string;
            createdAt: Date;
}

const userSchema: Schema<User> = new Schema({
            username: { type: String, required: [true, "username is required"], trim : true, unique: true },
            email: { type: String, required: [true, "email is required"], unique: true, match: [/\S+@\S+\.\S+/, 'please enter the valid email'] },
            password: { type: String, required: [true, "password is required"] },
            createdAt: { type: Date, default: Date.now },
});

const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ||
  mongoose.model<User>('User', userSchema);

export default UserModel;