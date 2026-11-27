/**
 * domain/reinvestment.js
 * Responsibility: tells new money put into an investment (an aporte) from a reinvestment: money that was already invested and went into a new
 * application (a CDB that matured and was applied again). A reinvestment is a record of what happened, but it is not new money: it is not
 * "Investido" in the month, it does not leave the month's cash (the money never left the bank), it does not count as a contribution in the
 * yield or the average, and it does not change a balance (balances are what the person types in "Atualizar saldos").
 */
export const isReinvestment=t=>t.type==='aporte'&&!!t.reinv;
export const isNewContribution=t=>t.type==='aporte'&&!t.reinv;
