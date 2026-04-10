import axios from 'axios';

export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.response?.data?.message || error.message;
  }
  if (error instanceof Error) return error.message;
  return '未知错误';
};
