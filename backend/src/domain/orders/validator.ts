/**
 * OrderValidator — Single Responsibility: validate order business rules.
 * Separated from order entity creation (SRP, GRASP Information Expert).
 */
export type ValidationContext = {
  balance: number;
  holdings: number;
  livePrice: number;
};

export type OrderPayload = {
  ticker: string;
  type: "market" | "limit" | "stop_loss";
  side: "buy" | "sell";
  quantity: number;
  limitPrice?: number | null;
};

export class OrderValidator {
  /**
   * Validates common rules for all order types.
   * Throws with a descriptive message on failure.
   */
  static validateCommon(payload: OrderPayload, ctx: ValidationContext): void {
    if (payload.quantity <= 0) {
      throw new Error("Quantity must be greater than 0");
    }

    if (payload.side === "buy") {
      const referencePrice = payload.limitPrice ?? ctx.livePrice;
      const required = referencePrice * payload.quantity;
      if (ctx.balance < required) {
        throw new Error(
          `Insufficient virtual balance. Need ₹${required.toFixed(2)}, have ₹${ctx.balance.toFixed(2)}`
        );
      }
    }
    // Short selling is allowed, so we do not restrict sell quantity against current holdings.
  }

  /** Additional validation specific to limit orders. */
  static validateLimitPrice(payload: OrderPayload): void {
    if (!payload.limitPrice || payload.limitPrice <= 0) {
      throw new Error("Limit orders require a positive limitPrice");
    }
  }

  /** Additional validation specific to stop-loss orders. */
  static validateTriggerPrice(payload: OrderPayload): void {
    if (!payload.limitPrice || payload.limitPrice <= 0) {
      throw new Error("Stop-loss orders require a positive trigger price");
    }
  }
}
