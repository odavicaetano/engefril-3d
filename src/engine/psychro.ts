/**
 * Psicrometria do ar úmido (ASHRAE Handbook—Fundamentals, cap. 1).
 * Pressão de saturação: equações de Hyland & Wexler (1983), sobre gelo (T<0 °C) e sobre água.
 * Unidades: T [°C], P [Pa], W [kg_vapor/kg_ar seco], h [kJ/kg_ar seco], v [m³/kg_ar seco].
 */
export const P_ATM = 101325;

export function pws(Tc: number): number {
  const T = Tc + 273.15;
  if (Tc < 0) {
    const C1 = -5.6745359e3, C2 = 6.3925247, C3 = -9.677843e-3, C4 = 6.2215701e-7, C5 = 2.0747825e-9, C6 = -9.484024e-13, C7 = 4.1635019;
    return Math.exp(C1 / T + C2 + C3 * T + C4 * T * T + C5 * T ** 3 + C6 * T ** 4 + C7 * Math.log(T));
  }
  const C8 = -5.8002206e3, C9 = 1.3914993, C10 = -4.8640239e-2, C11 = 4.1764768e-5, C12 = -1.4452093e-8, C13 = 6.5459673;
  return Math.exp(C8 / T + C9 + C10 * T + C11 * T * T + C12 * T ** 3 + C13 * Math.log(T));
}

export function humidityRatio(Tc: number, RH: number, P = P_ATM): number {
  const pw = Math.max(0, Math.min(1, RH)) * pws(Tc);
  return (0.621945 * pw) / (P - pw);
}
export function enthalpy(Tc: number, W: number): number {
  return 1.006 * Tc + W * (2501 + 1.86 * Tc);
}
export function specificVolume(Tc: number, W: number, P = P_ATM): number {
  return (0.287042 * (Tc + 273.15) * (1 + 1.607858 * W)) / (P / 1000);
}
export interface AirState { T: number; RH: number; W: number; h: number; v: number; rho: number }
/** Estado do ar úmido; rho é a massa específica da mistura (ar seco + vapor) [kg/m³]. */
export function air(Tc: number, RH: number, P = P_ATM): AirState {
  const W = humidityRatio(Tc, RH, P);
  const v = specificVolume(Tc, W, P);
  return { T: Tc, RH, W, h: enthalpy(Tc, W), v, rho: (1 + W) / v };
}
/** Temperatura de bulbo úmido termodinâmica [°C] por bisseção. */
export function wetBulb(Tc: number, RH: number, P = P_ATM): number {
  const W = humidityRatio(Tc, RH, P);
  let lo = -40, hi = Tc;
  for (let i = 0; i < 60; i++) {
    const tw = 0.5 * (lo + hi);
    const Ws = humidityRatio(tw, 1, P);
    // ASHRAE eq. 35 (acima de 0 °C) / 37 (abaixo)
    const Wc = tw >= 0
      ? ((2501 - 2.326 * tw) * Ws - 1.006 * (Tc - tw)) / (2501 + 1.86 * Tc - 4.186 * tw)
      : ((2830 - 0.24 * tw) * Ws - 1.006 * (Tc - tw)) / (2830 + 1.86 * Tc - 2.1 * tw);
    if (Wc > W) hi = tw; else lo = tw;
  }
  return 0.5 * (lo + hi);
}
export function dewPoint(Tc: number, RH: number): number {
  const target = RH * pws(Tc);
  let lo = -60, hi = Tc;
  for (let i = 0; i < 60; i++) { const m = 0.5 * (lo + hi); if (pws(m) > target) hi = m; else lo = m; }
  return 0.5 * (lo + hi);
}
