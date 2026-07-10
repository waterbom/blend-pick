# DB 환경 분리 (개발 / 상용)

## 구조

같은 RDS 인스턴스(`blendpunch-db.ctikyeuwquey.ap-northeast-2.rds.amazonaws.com`) 안에서
데이터베이스를 환경별로 분리해 사용한다.

| 환경 | OS DB (`DATABASE_URL`) | Shop DB (`SHOP_DATABASE_URL`) |
|------|------------------------|-------------------------------|
| **상용 (EC2)** | `blendpunch_dev` | `blendpunch_shop` |
| **개발 (로컬)** | `blendpunch_os_dev` | `blendpunch_shop_dev` |

> ⚠️ 이름 주의: 상용 OS DB 이름이 역사적인 이유로 `blendpunch_dev`다.
> 이름에 dev가 들어있지만 **실제 고객 데이터가 있는 상용 DB**이므로 절대 개발용으로 쓰지 말 것.
> (라이브 서비스 중이라 이름 변경은 다운타임 위험이 있어 그대로 유지)

## 연결 방식

코드는 DB 이름을 하드코딩하지 않고 환경변수만 읽는다 (`lib/db.ts`, `lib/db-shop.ts`).
따라서 각 환경의 `.env.local` 값만 다르면 분리가 완성된다.

- **EC2** `~/blend-pick/.env.local` → 상용 DB URL (변경 금지)
- **로컬 개발** `.env.local` → `_dev` DB URL

## 개발용 DB 만들기 / 초기화

EC2에서 실행 (상용 데이터를 개발 DB로 복사):

```bash
sudo apt update && sudo apt install -y postgresql-client
cd ~/blend-pick
bash scripts/create-dev-dbs.sh
```

- 이미 개발 DB가 있으면 건너뛴다. 상용 데이터로 다시 초기화하려면
  안내되는 `DROP DATABASE` 명령으로 지운 뒤 재실행.
- 스크립트는 상용 DB에는 읽기(pg_dump)만 수행한다.

## 스키마 변경 시 규칙

1. 개발 DB에 먼저 적용해서 확인
2. 배포 전에 같은 마이그레이션을 상용 DB에도 적용
   (`ALTER TABLE ... IF NOT EXISTS` 패턴 유지 — docs/dev-notes-2026-06.md 참고)
