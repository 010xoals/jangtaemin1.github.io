import json, math, datetime, pathlib, statistics
import FinanceDataReader as fdr
TODAY=datetime.date.today()
START=(TODAY-datetime.timedelta(days=110)).isoformat()
OUT=pathlib.Path("data/stocks.json")
SYMS=[("005930","삼성전자","반도체"),("000660","SK하이닉스","반도체"),("005380","현대차","자동차"),("035420","NAVER","인터넷"),("207940","삼성바이오로직스","바이오"),("068270","셀트리온","바이오"),("005490","POSCO홀딩스","소재"),("012330","현대모비스","자동차"),("105560","KB금융","금융"),("055550","신한지주","금융")]
def get(sym):
    df=fdr.DataReader(sym,START)
    if df is None or len(df)<25: raise ValueError("insufficient observations")
    df=df.dropna(subset=["Close"]).tail(70)
    closes=[float(x) for x in df["Close"].tolist()]
    dates=[str(x.date()) for x in df.index]
    vols=[float(x) for x in df["Volume"].fillna(0).tolist()] if "Volume" in df else []
    return closes,dates,vols
def stock(sym,name,sector):
    prices,dates,vols=get(sym)
    last=prices[-1]; prior=prices[-2]
    r20=last/prices[-21]-1
    r60=last/prices[max(0,len(prices)-61)]-1
    returns=[math.log(prices[i]/prices[i-1]) for i in range(1,len(prices)) if prices[i-1]>0]
    vol=statistics.stdev(returns[-40:])*math.sqrt(252) if len(returns)>2 else 0
    volume_ratio=(statistics.mean(vols[-5:])/statistics.mean(vols[-25:-5])) if len(vols)>25 and statistics.mean(vols[-25:-5])>0 else 1
    score=round(max(0,min(100,50+130*r20+45*r60+min(12,max(-8,(volume_ratio-1)*8))-14*vol)))
    reasons=[f"20거래일 가격 변화 {r20*100:+.1f}%",f"약 3개월 가격 변화 {r60*100:+.1f}%",f"연율화 과거 변동성 {vol*100:.1f}% · 최근 거래량 비율 {volume_ratio:.2f}배"]
    return dict(ticker=sym,name=name,sector=sector,price=round(last),previous=round(prior),change=round((last/prior-1)*100,2),score=score,reasons=reasons,history=[dict(date=d,close=round(p,2)) for d,p in zip(dates,prices)],volatility=round(vol,4))
def main():
    stocks=[];errors=[]
    for sym,name,sector in SYMS:
        try: stocks.append(stock(sym,name,sector))
        except Exception as e: errors.append(f"{sym}: {type(e).__name__}: {e}")
    if len(stocks)<5: raise RuntimeError("Only "+str(len(stocks))+" valid stocks; refusing to overwrite published data. "+"; ".join(errors))
    indexes={}
    for sym,name in [("KS11","KOSPI"),("KQ11","KOSDAQ")]:
        try:
            p,d,_=get(sym)
            indexes[name]=dict(value=round(p[-1],2),change=round((p[-1]/p[-2]-1)*100,2),date=d[-1])
        except Exception as e: errors.append(f"{name}: {e}")
    stocks.sort(key=lambda s:s["score"],reverse=True)
    data=dict(source="FinanceDataReader (NAVER/KRX endpoints; verify redistribution rights)",updated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),as_of=max(s["history"][-1]["date"] for s in stocks),universe_count=len(stocks),stocks=stocks[:5],indexes=indexes,errors=errors,methodology="20-day and ~60-day momentum, volume ratio, historical volatility; illustrative heuristic, not investment advice")
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"Updated {OUT}, date={data['as_of']}, stocks={len(stocks)}; errors={errors}")
if __name__=="__main__": main()
