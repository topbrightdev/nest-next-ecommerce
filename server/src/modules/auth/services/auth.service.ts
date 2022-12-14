import { envConfig } from '@common/config/env.config';
import {
	DataStoredFromToken,
	PayloadUserForJwtToken,
	UserFromRequest,
} from '@common/types/http.types';
import { emailRegex, User } from '@modules/user/user.schema';
import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmailService } from 'src/providers/email/email.service';
import {
	ChangePasswordInput,
	LoginUserInput,
	RegisterUserInput,
	ResetPasswordInput,
} from '../dto';
import { AuthToken } from '../dto/auth-token.object-type';
import { UpdateProfileInput } from '../dto/update-profile.input';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
	constructor(
		@InjectModel(User.name) private userModel: Model<User>,
		private passwordService: PasswordService,
		private jwtService: JwtService,
		private emailService: EmailService,
	) {}

	public async validateUser(input: LoginUserInput): Promise<User> {
		const { usernameOrEmail, password } = input;
		const isEmail = emailRegex.test(usernameOrEmail);
		let user: User | null;
		if (isEmail) {
			user = await this.userModel
				.findOne({ email: usernameOrEmail })
				.select('+password')
				.lean();
		} else {
			user = await this.userModel
				.findOne({ username: usernameOrEmail })
				.select('+password')
				.lean();
		}
		if (!user) return null;
		// Check password
		const isMatch = await this.passwordService.verify(user.password, password);
		if (!isMatch) return null;
		return user;
	}

	public async register(input: RegisterUserInput): Promise<string> {
		const payload: PayloadUserForJwtToken = {
			user: { ...input },
		};
		const expiredTime = envConfig().jwt.jwtExpiredTime;
		const token = await this.jwtService.signAsync(payload, {
			expiresIn: expiredTime,
		});
		await this.emailService.sendEmailConfirmation(input.email, token);
		return token;
	}

	public async activateAccount(token: string): Promise<User> {
		if (!token) return null;
		const decoded = await this.jwtService.verifyAsync(token);
		if (!decoded || !decoded?.user) return null;
		const dataRegister = decoded.user;
		const newUser = await this.userModel.create(dataRegister);
		await this.emailService.sendWelcome(newUser.email);
		return newUser;
	}

	public async forgotPassword(email: string): Promise<string> {
		if (!emailRegex.test(email)) throw new BadRequestException('Input must be email!');
		const user = await this.userModel.findOne({ email }).lean();
		if (!user) throw new BadRequestException(`User not found with email: ${email}`);
		const emailToken = await this.jwtService.signAsync(
			{ user },
			{ expiresIn: envConfig().jwt.jwtExpiredTime },
		);
		await this.emailService.sendResetPassword(email, emailToken);

		return emailToken;
	}

	public async resetPassword(input: ResetPasswordInput): Promise<User> {
		const { token, newPassword } = input;
		const decoded = await this.jwtService.verifyAsync(token);
		if (!decoded || !decoded.user)
			throw new BadRequestException('Token is invalid or missing');

		const userJwt = decoded.user;
		const realUser: User = await this.userModel
			.findOne({ email: userJwt.email })
			.select('+password')
			.lean();
		if (!realUser) throw new BadRequestException('Token is not valid');
		const hash = await this.passwordService.hash(newPassword);
		const updated: User = await this.userModel
			.findByIdAndUpdate(realUser._id, { password: hash }, { new: true })
			.lean();

		return updated;
	}

	// When use want to change password, they already know their old password
	public async changePassword(_id: string, input: ChangePasswordInput): Promise<User> {
		const { oldPassword, newPassword } = input;
		const user: User = await this.userModel.findById(_id).select('+password').lean();
		if (!user) throw new BadRequestException(`User with id: ${_id} not found`);
		const isMatch = await this.passwordService.verify(user.password, oldPassword);
		if (!isMatch)
			throw new BadRequestException(`Old password must match the current user password`);
		const newHash = await this.passwordService.hash(newPassword);
		const updated: User = await this.userModel
			.findByIdAndUpdate(_id, { password: newHash }, { new: true })
			.lean();
		return updated;
	}

	public async updateProfile(_id: string, input: UpdateProfileInput): Promise<User> {
		const user: User = await this.userModel.findById(_id).lean();
		if (!user) throw new BadRequestException(`User with id: ${_id} not found`);
		const updated: User = await this.userModel
			.findByIdAndUpdate(_id, input, { new: true })
			.lean();
		return updated;
	}

	public async getUserFromToken(token: string): Promise<User | null> {
		if (!token) return null;
		const decoded: DataStoredFromToken = await this.jwtService.verifyAsync(token);
		if (!decoded || !decoded?.user) return null;
		const { user } = decoded;
		const realUser: User = await this.userModel.findOne({ email: user.email }).lean();
		if (!realUser) return null;
		return realUser;
	}

	public async getUserFromRefreshToken(refreshToken: string): Promise<User | null> {
		if (!refreshToken) return null;
		const decoded: DataStoredFromToken = await this.jwtService.verifyAsync(refreshToken);
		const userReq: UserFromRequest = decoded.user;
		if (!decoded || !userReq) return null;
		const user: User = await this.userModel
			.findOne({ email: userReq.email })
			.select('+currentHashedRefreshToken')
			.lean();
		if (!user) return null;
		if (!user.currentHashedRefreshToken) return null;
		const isRefreshTokenMatching = await this.passwordService.verify(
			user.currentHashedRefreshToken,
			refreshToken,
		);

		if (!isRefreshTokenMatching) return null;
		return user;
	}
	public async resetCurrentHashedRefreshToken(
		id: string,
		refreshToken: string,
	): Promise<User> {
		const currentHashedRefreshToken = await this.passwordService.hash(refreshToken);
		const user: User = await this.userModel
			.findByIdAndUpdate(
				id,
				{
					currentHashedRefreshToken,
				},
				{ new: true },
			)
			.lean();
		return user;
	}

	public async resetAccessToken(payload: PayloadUserForJwtToken): Promise<string> {
		const expiredTime = envConfig().jwt.jwtExpiredTime;
		const accessToken = await this.jwtService.signAsync(payload, {
			expiresIn: expiredTime,
		});
		return accessToken;
	}

	public async generateAuthToken(payload: PayloadUserForJwtToken): Promise<AuthToken> {
		const envJwt = envConfig().jwt;
		const accessToken = await this.jwtService.signAsync(payload, {
			expiresIn: envJwt.jwtExpiredTime,
		});
		const refreshToken = await this.jwtService.signAsync(payload, {
			expiresIn: envJwt.jwtRefreshExpiredTime,
		});
		const authToken: AuthToken = {
			accessToken,
			refreshToken,
		};
		return authToken;
	}
}
