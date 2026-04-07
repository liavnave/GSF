import axios, { AxiosError, AxiosResponse } from "axios";
import type { Params } from "@/types/params";
import { ApiError, ResponseWithError } from "./types";



const api = axios.create({
	headers: {
		"Content-Type": "application/json",
	},
});

const responseBody = <DataType>({ data }: AxiosResponse<DataType>): DataType =>
	data;

const errorHandler = (err: AxiosError): ApiError => {
	return {
		message:
			typeof err.response !== "undefined"
				? (err.response.data as { message: string }).message
				: err.message,
		error: true,
	};
};

const normalizeQueryParams = (params: Params): Params => {
	const newParams: Params = {};
	Object.entries(params).forEach(([paramKey, paramValue]) => {
		if (Array.isArray(paramValue)) {
			newParams[paramKey] = paramValue.toString();
		} else {
			newParams[paramKey] = paramValue;
		}
	});
	return newParams;
};

export const requests = {
	get: <OutputType>(
		url: string,
		params: Params = {},
		abortController?: AbortController,
	) => {
		return api
			.get<OutputType>(url, {
				params: normalizeQueryParams(params),
				signal: abortController?.signal,
			})
			.then(responseBody)
			.catch(errorHandler) as unknown as ResponseWithError<OutputType>;
	},
};
