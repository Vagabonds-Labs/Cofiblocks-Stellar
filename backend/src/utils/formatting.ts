import { Response } from "express";

interface SuccessResponse<T> {
	success: true;
	timestamp: number;
	message: string;
	data: T;
  }
  
export function successResponse<T>(
	res: Response,
	data: T,
	message: string = 'Success',
	statusCode = 200
) {
	const body: SuccessResponse<T> = {
		success: true,
		timestamp: Date.now(),
		message,
		data,
	};

	return res.status(statusCode).json(body);
}