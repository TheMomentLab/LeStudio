# LeStudio UI/UX Regression Checklist (Post-Fix)

Date: 2026-02-25  
Last Verified: 2026-02-25  
Environment: `http://127.0.0.1:7860/`  
Method: Playwright real-browser walkthrough + frontend lint/build  
Viewports: Desktop `1440x900`, Mobile `390x844`

## Scope

- Status
- Mapping
- Motor Setup
- Calibration
- Teleop
- Record
- Dataset
- Train
- Eval

## Build / Static Verification

- `frontend`: `npm run lint` -> PASS
- `frontend`: `npm run build` -> PASS
- Browser console errors after full desktop+mobile walkthrough -> PASS (`Errors: 0`)

## Desktop Checklist (1440x900)

| Tab | Scenario | Result |
|---|---|---|
| Status | `Refresh All` button visible + verdict badge visible | PASS |
| Mapping | Rules panel summary + Mapping checklist visible | PASS |
| Motor Setup | Tab renders with expected heading | PASS |
| Calibration | Identify Wizard CTA visible | PASS |
| Teleop | Step panel + readiness checklist + guarded Start | PASS |
| Record | Sticky run summary + guarded Start | PASS |
| Dataset | Verdict badge + empty-state quick actions | PASS |
| Train | Verdict badge + Advanced Params collapse + guarded Start | PASS |
| Eval | Verdict badge + `Re-run 3 Episodes` + `Go to Train` + guarded Start | PASS |

## Mobile Checklist (390x844)

| Tab | Scenario | Result |
|---|---|---|
| Status | Single-column status grid on mobile | PASS |
| Mapping | Tab renders and navigation works via mobile menu | PASS |
| Motor Setup | Tab renders without layout break | PASS |
| Calibration | Mobile sticky controls visible | PASS |
| Teleop | Guarded Start remains disabled when prerequisites fail | PASS |
| Record | Sticky run summary visible + guarded Start | PASS |
| Dataset | Verdict badge visible in mobile layout | PASS |
| Train | Advanced Params collapsed by default and flow intact | PASS |
| Eval | Post-run CTAs rendered in mobile layout | PASS |

## Evidence Note

- 이전 문서에 기록된 `/home/jinhyuk2me/qa-*.png` 절대경로 증적은 현재 워크스페이스에 존재하지 않아 폐기했다.
- 향후 회귀 점검 증적은 저장소 내부 상대경로(예: `screenshots/qa/...`)로 보관한다.

## Conclusion

- 본 문서는 체크리스트 기준과 결과만 유지한다.
- 증적 파일 링크 기반 검증은 새 증적 세트를 확보한 뒤 갱신한다.
