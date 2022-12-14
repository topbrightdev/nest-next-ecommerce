import { Logger } from '@nestjs/common';
import util from 'util';
import fs from 'fs';
import mongoose, { Connection } from 'mongoose';
const readFile = util.promisify(fs.readFile);
import dotenv from 'dotenv';
import { User, UserSchema } from '@modules/user/user.schema';
import { Product, ProductSchema } from '@modules/product/schemas/product.schema';
// import argon2 from 'argon2';

let connection: Connection;
const createConnection = async (): Promise<Connection> => {
	dotenv.config();

	const mongoClient = await mongoose.connect(process.env.MONGODB_URI, {
		useCreateIndex: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
		useNewUrlParser: true,
	});

	Logger.log('Database connected');
	connection = mongoClient.connection;
	return connection;
};

async function uploadData() {
	try {
		await createConnection();
	} catch (error) {
		Logger.error(error.message);
		process.exit(1);
	}
	Logger.log('Start uploading....');

	const UserModel = mongoose.model<User>('users', UserSchema);
	const ProductModel = mongoose.model<Product>('products', ProductSchema);

	await UserModel.deleteMany();
	await ProductModel.deleteMany();

	const file = process.cwd() + `/src/providers/database/data.json`;

	const json = await readFile(file, { encoding: 'utf8' });
	const { users, products } = JSON.parse(json);

	await UserModel.create(users);
	const user = await UserModel.findOne({ username: 'admin1' });

	const customProducts = [];

	const names = [];
	for (const product of products) {
		if (!names.includes(product.name)) {
			names.push(product.name);
			customProducts.push({
				...product,
				user,
				countInStock: 10,
				price: parseInt(product.price),
				name: product.name || 'Missing',
			});
		}
	}

	await ProductModel.create(customProducts);

	Logger.log('Data created');
}

Promise.resolve(uploadData())
	.catch((err) => Logger.error(err))
	.finally(async () => {
		await connection.close();
	});
