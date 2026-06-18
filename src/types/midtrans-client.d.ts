declare module "midtrans-client" {
  export class Snap {
    constructor(config: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    createTransaction(
      params: Record<string, any>
    ): Promise<{ token: string; redirect_url: string }>;
    transactionStatus(orderId: string): Promise<Record<string, any>>;
  }

  export class CoreApi {
    constructor(config: {
      isProduction: boolean;
      serverKey: string;
      clientKey: string;
    });
    charge(params: Record<string, any>): Promise<Record<string, any>>;
    transaction(orderId: string): Promise<Record<string, any>>;
  }
}
