export type ResponseWithError<ValidResponseType> = ValidResponseType &
	Partial<ApiError>;
export type ApiError = {
	message: string;
	error: boolean;
};

export type ResponseWithCount<T> = {
	data: T;
	count: number;
  };