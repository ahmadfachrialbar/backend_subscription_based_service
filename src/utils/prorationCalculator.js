/**
 * Proration Calculator
 * Menghitung biaya proration saat upgrade/downgrade paket
 */

/**
 * Hitung jumlah hari tersisa pada periode saat ini
 * @param {Date} periodEnd - tanggal akhir periode
 * @returns {number} jumlah hari tersisa
 */
const getRemainingDays = (periodEnd) => {
    const now = new Date();
    const end = new Date(periodEnd);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
};

/**
 * Hitung total hari dalam periode billing
 * @param {string} billingCycle - 'monthly' atau 'yearly'
 * @returns {number} total hari
 */
const getTotalDaysInCycle = (billingCycle) => {
    switch (billingCycle) {
        case 'monthly': return 30;
        case 'yearly': return 365;
        case 'forever': return 0;
        default: return 30;
    }
};

/**
 * Hitung kredit dari sisa paket lama (yang belum terpakai)
 * @param {Object} currentPlan - plan saat ini { price, billing_cycle }
 * @param {Date} periodEnd - tanggal akhir periode saat ini
 * @returns {number} kredit proration
 */
const calculateCredit = (currentPlan, periodEnd) => {
    if (currentPlan.price <= 0) return 0;

    const remainingDays = getRemainingDays(periodEnd);
    const totalDays = getTotalDaysInCycle(currentPlan.billing_cycle);
    
    if (totalDays === 0) return 0;

    const dailyRate = parseFloat(currentPlan.price) / totalDays;
    const credit = Math.round(dailyRate * remainingDays * 100) / 100;

    return credit;
};

/**
 * Hitung biaya proration untuk paket baru
 * @param {Object} newPlan - plan baru { price, billing_cycle }
 * @param {number} remainingDays - hari tersisa di periode lama
 * @returns {number} biaya proration untuk paket baru
 */
const calculateNewPlanCharge = (newPlan, remainingDays) => {
    if (newPlan.price <= 0) return 0;

    const totalDays = getTotalDaysInCycle(newPlan.billing_cycle);
    if (totalDays === 0) return 0;

    const dailyRate = parseFloat(newPlan.price) / totalDays;
    const charge = Math.round(dailyRate * remainingDays * 100) / 100;

    return charge;
};

/**
 * Hitung proration lengkap untuk upgrade/downgrade
 * @param {Object} currentPlan - plan saat ini
 * @param {Object} newPlan - plan baru
 * @param {Date} periodEnd - tanggal akhir periode saat ini
 * @returns {Object} { credit, charge, amountDue, isUpgrade, remainingDays, summary }
 */
const calculateProration = (currentPlan, newPlan, periodEnd) => {
    const remainingDays = getRemainingDays(periodEnd);
    const credit = calculateCredit(currentPlan, periodEnd);
    const charge = calculateNewPlanCharge(newPlan, remainingDays);
    const amountDue = Math.max(0, Math.round((charge - credit) * 100) / 100);
    const isUpgrade = parseFloat(newPlan.price) > parseFloat(currentPlan.price);

    return {
        current_plan: {
            name: currentPlan.name,
            price: parseFloat(currentPlan.price),
            billing_cycle: currentPlan.billing_cycle
        },
        new_plan: {
            name: newPlan.name,
            price: parseFloat(newPlan.price),
            billing_cycle: newPlan.billing_cycle
        },
        remaining_days: remainingDays,
        credit: credit,
        charge: charge,
        amount_due: amountDue,
        is_upgrade: isUpgrade,
        type: isUpgrade ? 'upgrade' : 'downgrade',
        summary: isUpgrade
            ? `Upgrade dari ${currentPlan.name} ke ${newPlan.name}. Kredit sisa: Rp ${credit.toLocaleString('id-ID')}. Biaya baru: Rp ${charge.toLocaleString('id-ID')}. Total bayar: Rp ${amountDue.toLocaleString('id-ID')}`
            : `Downgrade dari ${currentPlan.name} ke ${newPlan.name}. Kredit sisa: Rp ${credit.toLocaleString('id-ID')}. Biaya baru: Rp ${charge.toLocaleString('id-ID')}. Selisih dikembalikan sebagai credit.`
    };
};

module.exports = { calculateProration, calculateCredit, calculateNewPlanCharge, getRemainingDays, getTotalDaysInCycle };
