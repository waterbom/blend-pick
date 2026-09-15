// Operator approved 2026-09-15. Annual pricing periods, inclusive at both ends.
// Comparable sources and the distinction from dispute-resolution seasons are in docs/dangung-booking.md.
const LAUNCH_REVISION='2026-09-15-open-v1';
const PRICING_REVISION='2026-09-15-season-average-v2';
const ORIGINAL_RANGES={shoulderRanges:[['07-15','07-24'],['08-10','08-24'],['12-24','12-24'],['12-31','12-31']],peakRanges:[['07-25','08-09']]};
const PRICING_PLAN={
 basePrice:450000,weekendSurcharge:100000,shoulderSurcharge:100000,peakSurcharge:150000,
 weekendDays:[5,6],
 shoulderRanges:[['07-12','07-24'],['08-10','08-27'],['12-24','12-24'],['12-31','12-31']],
 peakRanges:[['07-25','08-09']],
};
function nightlyPrice(day,plan=PRICING_PLAN){
 const parsed=new Date(day+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)throw Error('Invalid pricing date');
 const md=day.slice(5),within=ranges=>ranges.some(([start,end])=>start<=end?md>=start&&md<=end:md>=start||md<=end);
 const level=within(plan.peakRanges)?'peak':within(plan.shoulderRanges)?'shoulder':'normal';
 const weekend=plan.weekendDays.includes(parsed.getUTCDay());
 const extra=level==='peak'?plan.peakSurcharge:level==='shoulder'?plan.shoulderSurcharge:0;
 const price=plan.basePrice+extra+(weekend?plan.weekendSurcharge:0);
 if(!Number.isSafeInteger(price)||price<=0||price>10000000)throw Error('Invalid nightly price');
 return {day,price,season:`${{normal:'일반',shoulder:'준성수기',peak:'극성수기'}[level]} · ${weekend?'금·토':'일~목'}`,available:true};
}
module.exports={LAUNCH_REVISION,PRICING_REVISION,ORIGINAL_RANGES,PRICING_PLAN,nightlyPrice};
