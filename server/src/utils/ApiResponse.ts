export class ApiResponse<T = any> {
  public success: boolean;
  public data: T | null;
  public errors: string | null;

  constructor(
    success: boolean,
    data: T | null = null,
    errors: string | null = null,
  ) {
    this.success = success;
    this.data = data;
    this.errors = errors;
  }
}
