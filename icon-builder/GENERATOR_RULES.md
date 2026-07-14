# HHG SVG 아이콘 생성기 규칙

범용 아이콘 생성기 사양. UI 버튼 / 인포그래픽 / 다이어그램 / 앱 아이콘 / 기업 로고 등 모든 용도 대응.
사람이 기본 템플릿(부속)을 조합해 아이콘을 만들거나, 기존 아이콘을 골라 SVG / PNG / JPG로 export 한다.

> 생성기 **사용자 페이지**는 `design/design_system.html`을 따른다. **아이콘 자체**는 이 규칙만 따른다.

---

## 1. 좌표계

- `viewBox="0 0 24 24"`
- 그리드 24 단위
- 안전여백 1 → **라이브영역 22×22** (느슨)
- 프레임 4분할: 각 블럭 12×12 차지, 내용은 라이브영역까지 확장 가능
- export 크기는 자유 (SVG 벡터 기준, 캔버스 크기 제약 없음)

---

## 2. 스타일

대부분의 스타일 지원이 최종 목표. 우선 `bold`(볼드 라인)부터 구현.

### 예약 style 코드

| 코드 | 의미 | 상태 |
|------|------|------|
| `bold` | 볼드 라인 | ✅ 1순위 구현 |
| `line` | 얇은 라인 | 예약 |
| `fill` | 솔리드 채움 | 예약 |
| `duo` | 듀오톤(2색) | 예약 |
| `flat` | 플랫 멀티컬러 | 예약 |
| `soft` | 둥근 채움 | 예약 |
| `sharp` | 각진 라인 | 예약 |

### bold 기본값 (생성기에서 조정 가능)

| 속성 | 기본값 |
|------|--------|
| `stroke-width` | 2 (24 기준) |
| `stroke-linecap` | round |
| `stroke-linejoin` | round |
| 코너 반경 | 2 |
| `fill` | none |

stroke 두께·linecap·linejoin·코너 반경 모두 생성기에서 변경 가능.

---

## 3. 색상

4개 역할을 CSS 변수로 주입. 지정하면 변경 가능.

| 역할 | 변수 |
|------|------|
| 메인 | `--hhg-main` |
| 포인트 | `--hhg-point` |
| 보조 | `--hhg-sub` |
| 배경 | `--hhg-bg` |

- 각 부속 SVG는 기본 매핑을 명시한다. 예: `stroke="var(--hhg-main)"`, `fill="none"`
- 조립/생성 단계에서 매핑을 덮어쓸 수 있다.
  - 예: 배경색을 fill로 채움, 포인트색을 라인으로 → 라인 강조 아이콘
- 색 역할(main/point/sub/bg)을 fill / stroke 어디에 매핑할지는 자유롭게 변경 가능.

---

## 4. 조립 구조

부속은 **프레임**과 **인서트**로 나뉜다.

### 프레임 (frame)
- 공간을 4분할: 좌상(tl) · 우상(tr) · 좌하(bl) · 우하(br)
- 블럭 4개를 조립해 하나의 프레임 구성
- 각 블럭은 코너 고정 (quad 종속)

### 인서트 (insert)
- 프레임 위에 레이어링
- 기본 앵커 5종: tl · tr · bl · br · c(중앙)
- 미세조정 좌표(offset)로 위치 보정 가능
- 코너 고정 아님 → 앵커는 조립 시 결정

---

## 5. 파일 구조

```
icon/
  parts/
    frame/    frm_*.svg     (코너 고정 부속)
    insert/   ins_*.svg     (앵커 자유 부속)
  icons/      *.hhg         (조립 정의, JSON 형식)
  build/      *.svg .png .jpg  (export 결과물)
```

- 부속: 개별 `.svg`
- 조립된 아이콘: `.hhg` (JSON 형식, 별도 확장자)
- 빌드 완성본: `.svg` / `.png` / `.jpg`

---

## 6. 네이밍 규칙

**구분자**: 필드 사이 `_`, 필드 내 다단어 `-`. 전부 소문자.

### 부속 (svg)

프레임 블럭:
```
frm_{quad}_{style}_{name}.svg
```
- `quad` ∈ `tl` | `tr` | `bl` | `br`
- 예: `frm_tl_bold_corner-round.svg`

인서트:
```
ins_{style}_{category}_{name}.svg
```
- 예: `ins_bold_media_play.svg`, `ins_bold_arrow_up.svg`

개정: 끝에 `_v2`, `_v3` … (v1은 생략)

### 조립 아이콘 (hhg)
```
{category}_{name}.hhg
```
- 예: `media_play-circle.hhg`

### 빌드 export

| 형식 | 규칙 | 예 |
|------|------|----|
| svg | `{category}_{name}_{W}x{H}.svg` | `media_play-circle_512x512.svg` |
| png | `{category}_{name}_{W}x{H}@{scale}x.png` | `media_play-circle_512x512@2x.png` |
| jpg | `{category}_{name}_{W}x{H}.jpg` | `media_play-circle_512x512.jpg` |

- 팔레트 변형 시 끝에 `_{paletteid}` 옵션: `media_play-circle_512x512_dark.png`

---

## 7. hhg JSON 스키마

```json
{
  "hhg": "1.0",
  "id": "media_play-circle",
  "name": "Play Circle",
  "category": "media",
  "style": "bold",
  "viewBox": "0 0 24 24",
  "stroke": { "width": 2, "linecap": "round", "linejoin": "round", "radius": 2 },
  "palette": { "main": "#...", "point": "#...", "sub": "#...", "bg": "transparent" },
  "frame": [
    { "quad": "tl", "part": "frm_tl_bold_corner-round", "map": { "stroke": "main", "fill": "none" } },
    { "quad": "tr", "part": "frm_tr_bold_corner-round", "map": {} },
    { "quad": "bl", "part": "frm_bl_bold_corner-round", "map": {} },
    { "quad": "br", "part": "frm_br_bold_corner-round", "map": {} }
  ],
  "inserts": [
    {
      "part": "ins_bold_media_play",
      "anchor": "c",
      "offset": [0, 0],
      "scale": 1,
      "rotate": 0,
      "map": { "stroke": "point" }
    }
  ]
}
```

### 필드 의미

| 필드 | 의미 |
|------|------|
| `hhg` | 포맷 버전 |
| `id` | 아이콘 식별자 (`{category}_{name}`) |
| `name` | 표시 이름 |
| `category` | 분류 |
| `style` | 예약 style 코드 중 하나 |
| `viewBox` | 좌표계 (기본 `0 0 24 24`) |
| `stroke` | 라인 스펙 (width/linecap/linejoin/radius) |
| `palette` | 4색 역할 값 (main/point/sub/bg) |
| `frame` | 프레임 블럭 배열, 최대 4 (quad별 1개). 빈 quad 생략 가능 |
| `inserts` | 인서트 배열 0~N |
| `map` | 부속 색역할 덮어쓰기 (main/point/sub/bg → fill/stroke) |

#### frame 항목
| 필드 | 의미 |
|------|------|
| `quad` | tl/tr/bl/br |
| `part` | 부속 파일명 (확장자 제외) |
| `map` | 색 매핑 덮어쓰기 |

#### insert 항목
| 필드 | 의미 |
|------|------|
| `part` | 부속 파일명 (확장자 제외) |
| `anchor` | tl/tr/bl/br/c |
| `offset` | `[x, y]` 미세조정 |
| `scale` | 배율 |
| `rotate` | 회전(도) |
| `map` | 색 매핑 덮어쓰기 |
