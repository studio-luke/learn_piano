// ===== 프로필 사진 (화면) =====
// 사진이 있으면 사진, 없으면 닉네임 첫 글자를 동그라미 안에 보여줘요. 머리글 버튼, 내 계정 사이드바, 회원 정보 변경 화면에서 써요.
// 사진 파일 저장·주소는 account.js(Account.uploadAvatar, avatarUrl), DB 권한은 supabase/schema.sql "profile photos".
import { avatarInitial } from "./helpers.js";

// 올리기 전에 줄이는 크기 (정사각형, px). 작게 표시해도 선명하고 파일은 30KB 안팎
const SIZE = 256;

/**
 * el(.avatar 요소)에 사진 또는 닉네임 첫 글자를 그림.
 * 사진 주소가 깨지면(지워졌거나 네트워크 문제) 첫 글자로 바꿈
 */
export function drawAvatar(el, url, nickname) {
  if (!el) return;
  const letter = avatarInitial(nickname);
  el.textContent = "";
  el.classList.toggle("has-photo", !!url);
  if (!url) { el.textContent = letter; return; }
  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.onerror = () => { el.classList.remove("has-photo"); el.textContent = letter; };
  img.src = url;
  el.appendChild(img);
}

/**
 * 고른 이미지 파일 → 가운데를 정사각형으로 잘라 256×256 JPEG Blob으로.
 * 투명한 부분(PNG)은 흰색으로 채움. 사진의 회전 정보(폰 사진)는 브라우저가 반영함
 */
export async function squareJpeg(file) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
  bmp.close && bmp.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("image");
  return blob;
}
