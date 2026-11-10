// ===== 출제 설정 공유 링크 (2026-11-10 사용자 요청) =====
// 선생님(지금은 관리자)이 문제 페이지의 [🔗 이 설정으로 링크 만들기]를 누르면 지금 출제 설정이 담긴 주소를 복사해요.
// 그 주소를 연 사람에게는 "이 설정으로 바꿀까요?" 창을 띄우고, [바꾸기]면 이 기기와 계정(로그인했으면) 설정을 모두 바꿔요.
// 학생에게 "이렇게 옵션 설정하고 연습해"라고 말해도 잘 따라 하지 않아서 만든 기능이에요.
//
// 링크 모양:  https://chordoven.com/trainer/chords/?preset=1-maj.min.M7.dom7-0.2.4-1-BC
//   ?preset=<버전>-<코드 종류 id를 .으로>-<베이스 pc를 .으로>-<텐션 최대 개수>-<켜진 옵션 글자>
//   - 버전 "1": 형식을 바꾸면 2로 올리고 1도 계속 읽을 것(이미 보낸 링크가 있어서)
//   - 코드 종류는 순서 번호가 아니라 id(engine.js TYPES)로 담음 → 코드 종류가 늘어도 예전 링크가 그대로 맞음
//   - 옵션 글자: B(특정 베이스만) C(세븐코드 텐션) D(기호 표기 혼용) E(복잡한 음 표현) I(자리바꿈 허용)
//                코드 초견 무작위 코드 모드: S(분수코드 허용) H(한 코드당 ½마디) L(2마디) — H·L이 없으면 1마디 (2026-11-10)
//   - 주소는 언어 없는 입구(/trainer/chords/)로 만듦 → 받는 사람 기기의 언어로 열림. 입구가 ?preset을 넘겨줌(build.js entryPage)
//   - 글자는 영문·숫자·.·-만 → 메신저에서 잘리거나 바뀌지 않음
//
// 공유하는 것: 코드 종류, 옵션 B와 베이스, 옵션 C와 텐션 개수, D·E(랜덤 코드 연습), E·자리바꿈(코드 추론하기).
// 공유하지 않는 것: 키보드로 건반 입력·MIDI(기기별), 소리·건반 음이름 표시·[심화] 펼침(보는 사람 취향), 타이머(설정이 아니라 켜고 끄는 상태 — 사용자 결정).
// 버튼을 숨기는 건 화면에서만이라 형식을 아는 사람은 링크를 직접 만들 수 있지만, 링크는 연 사람 자신의 설정만
// 그 사람이 [바꾸기]를 눌렀을 때 바꾸므로 괜찮아요. 대신 읽을 때 허용 목록으로 값을 꼼꼼히 걸러요(preset.js decodePreset).
import { Account } from "../account/account.js";
import { ROOT } from "./sitemap.js";
import { t } from "../i18n/index.js";
import { $, esc, toast } from "./dom.js";
import { PRESET_PARAM, encodePreset, decodePreset, samePreset } from "./preset.js";

/** 공유 링크 주소 (언어 없는 입구 주소) */
export const presetUrl = (S, spec) => `${ROOT}${spec.route}?${PRESET_PARAM}=${encodePreset(S, spec)}`;

/**
 * 로그인 확인이 끝나면 fn을 한 번 부름: 로그인 안 함 → 바로, 로그인함 → 계정 프로필(과 페이지의 계정 설정 받기)이 끝난 뒤.
 * 페이지의 "profile" 처리(계정 설정으로 바꾸기)가 먼저 끝나도록 한 차례 미뤄서 부름. 네트워크 문제로 소식이 없으면 5초 뒤에라도
 */
function whenSettled(fn) {
  let done = false;
  const go = () => { if (!done) { done = true; setTimeout(fn, 0); } };
  const check = () => {
    if (!Account.ready) return;
    if (!Account.user) return go();
    if (Account.profile && (Account.profile.deleted_at || Account.needsConsent())) go();   // 탈퇴 유예·소셜 첫 방문: 계정 설정을 쓰지 않음
  };
  Account.on("change", check);
  Account.on("profile", go);
  setTimeout(go, 5000);
  check();
}

// ---------- 화면 ----------
// 작은 확인 창 하나를 두 용도로 씀: 링크를 연 사람에게 묻기 / 복사가 안 될 때 링크 보여 주기. 모양은 base.css dialog.mini-dlg
function miniDialog(html) {
  let dlg = $("presetDlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "presetDlg"; dlg.className = "mini-dlg";
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = html;
  dlg.showModal();
  return dlg;
}

/** 링크를 클립보드에 복사. 안 되면(http LAN 주소 등 보안 컨텍스트가 아닌 곳) 링크를 고른 상태로 보여 줌 */
async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    toast(t("presetCopied"));
  } catch {
    const dlg = miniDialog(`<p>${esc(t("presetCopyManual"))}</p>
      <input class="mini-dlg-url" type="text" readonly value="${esc(url)}">
      <div class="mini-dlg-btns"><button type="button" class="btn primary" data-close>${esc(t("close"))}</button></div>`);
    const input = dlg.querySelector("input");
    input.focus(); input.select();
    dlg.querySelector("[data-close]").onclick = () => dlg.close();
  }
}

/**
 * 공유 링크 연결: 버튼(관리자만 보임)과, 이 페이지를 ?preset 주소로 열었을 때의 확인 창.
 * @param spec    PresetSpec
 * @param S       그 페이지의 출제 설정 객체(읽기만 — 링크 만들 때), 또는 그런 객체를 돌려주는 함수
 *                (코드 초견처럼 링크에 담기 전에 값을 바꿔야 할 때 — 마디수 "0.5" → barsHalf)
 * @param apply   (설정 일부) => void  [바꾸기]를 눌렀을 때 페이지가 S에 넣고 화면·저장(기기+계정)·새 문제까지 처리
 * @param hasPrior () => boolean  지금 이 사람에게 덮어쓸 "원래 설정"이 있는지 — 이 기기에 저장된 설정이 있거나, 로그인했고 계정에 그 페이지 설정이 있으면 true.
 *                 없으면(처음 온 사람·로그인 안 했고 저장된 설정 없음) 묻지 않고 바로 적용 (2026-11-10 사용자 요청)
 * @returns {{ pending: boolean, consume(): boolean }}
 *   pending   주소에 ?preset이 있었는지 (페이지가 ?review=1과 함께 왔을 때 다시 풀기를 시작하지 않으려고)
 *   consume() 계정 설정을 받기 직전에 부름: 링크 설정을 적용했고 아직 계정에 올리지 않았으면 true(한 번만).
 *             로그인한 학생은 페이지를 열 때마다 계정 설정이 기기 설정을 덮어써서(Account "profile"),
 *             true면 페이지가 계정 설정을 받는 대신 지금 설정을 계정에 올려야 링크 설정이 되돌아가지 않음
 */
export function initPresetLink({ spec, S, apply, hasPrior = () => true }) {
  // 버튼: 관리자에게만 (선생님 역할이 생기면 여기 조건에 추가)
  const btn = $("presetBtn");
  const showBtn = () => { btn.hidden = !Account.isAdmin(); };
  Account.on("change", showBtn); showBtn();
  btn.onclick = () => copyLink(presetUrl(typeof S === "function" ? S() : S, spec));

  // 주소에 ?preset이 있으면: 주소창에서 먼저 지우고(새로고침해도 다시 묻지 않게), 로그인 확인이 끝난 뒤 정함 (2026-11-10 사용자 요청):
  //   - 지금 설정과 같음 → 아무것도 안 함
  //   - 덮어쓸 원래 설정이 없음(hasPrior() false — 처음 온 사람, 로그인 안 했고 저장된 설정 없음) → 묻지 않고 적용 + "출제 설정을 바꿨어요." 알림
  //   - 그 밖 → "이 설정으로 바꿀까요?" 창
  // 로그인 확인을 기다리는 이유: 로그인한 학생은 계정 설정이 페이지를 열 때 기기 설정을 덮어써서, 그 뒤의 설정과 비교해야 맞음
  const params = new URLSearchParams(location.search);
  const raw = params.get(PRESET_PARAM);
  const state = { pending: raw != null, applied: false };
  if (raw != null) {
    params.delete(PRESET_PARAM);
    params.delete("review");   // ?review=1과 함께 왔으면 다시 풀기는 시작하지 않으므로(pending) 새로고침 때 시작되지 않게 같이 지움
    const q = params.toString();
    history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
    const preset = decodePreset(raw, spec);
    if (!preset) toast(t("presetBad"));
    else whenSettled(() => {
      const cur = typeof S === "function" ? S() : S;
      if (samePreset(preset, cur, spec)) return;
      const applyNow = () => {
        // 이미 로그인 정보를 받은 뒤면 apply의 save()가 계정에도 바로 저장함 → consume()이 할 일 없음
        state.applied = !Account.active();
        apply(preset);
        toast(t("presetDone"));
      };
      if (!hasPrior()) return applyNow();
      const dlg = miniDialog(`<p>${esc(t("presetAsk"))}</p>
        <div class="mini-dlg-btns"><button type="button" class="btn" data-no>${esc(t("cancel"))}</button><button type="button" class="btn primary" data-yes>${esc(t("presetApply"))}</button></div>`);
      dlg.querySelector("[data-no]").onclick = () => dlg.close();
      dlg.querySelector("[data-yes]").onclick = () => { dlg.close(); applyNow(); };
    });
  }
  return {
    pending: state.pending,
    consume() { const was = state.applied; state.applied = false; return was; },
  };
}
