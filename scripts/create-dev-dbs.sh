#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# 개발용 DB 생성 스크립트
#
# 상용 DB(blendpunch_dev, blendpunch_shop)를 복사해서
# 같은 RDS 안에 개발용 DB 2개를 만든다:
#   - blendpunch_os_dev    (blendpunch_dev 복사본)
#   - blendpunch_shop_dev  (blendpunch_shop 복사본)
#
# 사용법 (EC2에서):
#   sudo apt update && sudo apt install -y postgresql-client
#   cd ~/blend-pick
#   bash scripts/create-dev-dbs.sh
#
# 전제: .env.local 에 상용 DATABASE_URL / SHOP_DATABASE_URL 존재
# ============================================================

ENV_FILE="${1:-.env.local}"
OS_DEV_DB="blendpunch_os_dev"
SHOP_DEV_DB="blendpunch_shop_dev"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE 파일이 없습니다. 상용 DB URL이 있는 env 파일 경로를 인자로 주세요."
  exit 1
fi

get_var() {
  grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'"
}

DATABASE_URL="$(get_var DATABASE_URL)"
SHOP_DATABASE_URL="$(get_var SHOP_DATABASE_URL)"

if [ -z "$DATABASE_URL" ] || [ -z "$SHOP_DATABASE_URL" ]; then
  echo "❌ $ENV_FILE 에서 DATABASE_URL / SHOP_DATABASE_URL 을 찾지 못했습니다."
  exit 1
fi

# URL의 DB 이름 부분만 교체 (쿼리스트링 유지)
replace_db() {
  local url="$1" newdb="$2"
  local prefix="${url%/*}"
  local last="${url##*/}"
  local q=""
  case "$last" in *\?*) q="?${last#*\?}" ;; esac
  printf '%s/%s%s' "$prefix" "$newdb" "$q"
}

export PGSSLMODE="${PGSSLMODE:-require}"

ADMIN_URL="$(replace_db "$DATABASE_URL" postgres)"
OS_DEV_URL="$(replace_db "$DATABASE_URL" "$OS_DEV_DB")"
SHOP_DEV_URL="$(replace_db "$SHOP_DATABASE_URL" "$SHOP_DEV_DB")"

db_exists() {
  psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname='$1'" | grep -q 1
}

copy_db() {
  local src_url="$1" dev_db="$2" dev_url="$3"
  if db_exists "$dev_db"; then
    # 존재하지만 테이블이 하나도 없으면(이전 실행이 중간에 실패) 이어서 복사
    local tables
    tables=$(psql "$dev_url" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
    if [ "$tables" -gt 0 ]; then
      echo "⚠️  $dev_db 가 이미 존재합니다(테이블 ${tables}개). 상용 데이터로 다시 초기화하려면:"
      echo "    psql \"$ADMIN_URL\" -c 'DROP DATABASE $dev_db;' && bash scripts/create-dev-dbs.sh"
      return 0
    fi
    echo "▶ $dev_db 가 비어있어 복사만 이어서 진행합니다"
  else
    echo "▶ CREATE DATABASE $dev_db"
    psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dev_db;"
  fi
  echo "▶ 데이터 복사 중... (상용 → $dev_db)"
  pg_dump "$src_url" --no-owner --no-privileges | psql "$dev_url" -q -v ON_ERROR_STOP=1
  echo "✅ $dev_db 완료"
}

copy_db "$DATABASE_URL" "$OS_DEV_DB" "$OS_DEV_URL"
copy_db "$SHOP_DATABASE_URL" "$SHOP_DEV_DB" "$SHOP_DEV_URL"

echo ""
echo "=========================================================="
echo "🎉 개발용 DB 준비 완료. 개발 환경의 .env.local 을 아래로 바꾸세요:"
echo ""
echo "DATABASE_URL=$OS_DEV_URL"
echo "SHOP_DATABASE_URL=$SHOP_DEV_URL"
echo ""
echo "⚠️  상용 서버(EC2)의 .env.local 은 절대 바꾸지 마세요!"
echo "=========================================================="
