#!/usr/bin/env bash
# Chay phong thi nghiem thuat toan tren nhieu luong CPU cung luc.
#
# Vong tim kiem la tuan tu tu dau den cuoi: moi nuoc di phu thuoc lich ma nuoc di truoc de
# lai, nen mot lan chay khong chia nho ra duoc. Nhung cac LAN CHAY thi doc lap voi nhau, nen
# chay chung song song — moi tien trinh mot thuat toan, mot lan — thi nhanh gan bang so luong.
#
# Dung: bash scripts/benchmark-lab-parallel.sh <so-lan> <so-vong-lap> <song-song> <thu-muc-ra>
set -u

RUNS="${1:-5}"
ITERATIONS="${2:-700000}"
PARALLEL="${3:-8}"
OUT="${4:-benchmark-out}"

SOLVERS="SYSTEM_HYBRID SIMULATED_ANNEALING TABU_SEARCH LATE_ACCEPTANCE LOCAL_SEARCH HILL_CLIMBING GREEDY"

# Moi tien trinh mo nhom ket noi CSDL rieng, mac dinh vai chuc ket noi. Tam tien trinh cung
# luc la vuot gioi han cua Postgres, nen gioi han moi tien trinh sau ket noi. Hai la qua it:
# doan nap du lieu goi nam truy van cung luc, cac truy van xep hang cho qua han va ca lan
# chay hong — da mat 14 trong 35 lan chay vi dung cho nay. Bien moi truong
# that thang tep .env, nen dat o day la du.
DB_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')"
export DATABASE_URL="${DB_URL}&connection_limit=6&pool_timeout=120&connect_timeout=60"

mkdir -p "$OUT/runs"

for run in $(seq 1 "$RUNS"); do
  for solver in $SOLVERS; do
    # Lan nao da co ket qua thi bo qua: chay lai lenh nay chi lam not nhung lan con thieu
    [ -f "$OUT/runs/${solver}-${run}.json" ] && continue
    # Giu toi da PARALLEL tien trinh cung luc
    while [ "$(jobs -rp | wc -l)" -ge "$PARALLEL" ]; do wait -n; done
    (
      # Goi thang ts-node, khong qua npx: nhieu npx chay cung luc tren Windows tranh nhau khoa
      # bo nho dem cua npm va treo o 0% CPU. Bo kiem kieu vi tsc da kiem roi.
      node -r ts-node/register/transpile-only scripts/run-benchmark-lab.ts 1 "$ITERATIONS" "$OUT/runs/${solver}-${run}.json" "$solver" \
        > "$OUT/runs/${solver}-${run}.log" 2>&1
      echo "xong ${solver} lan ${run}: $(tail -1 "$OUT/runs/${solver}-${run}.log")"
    ) &
  done
done

wait
echo "TAT CA XONG"
