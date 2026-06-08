const { useState, useEffect, useCallback } = React;

const SUPABASE_URL = "https://lbflhbogfhtnjjnxjntb.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZmxoYm9nZmh0bmpqbnhqbnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjU1MTAsImV4cCI6MjA5NTkwMTUxMH0.R4OHHkHHGGhC_9mkUbuQ52Hu75340X4H-MvadAqG7jQ";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: opts.prefer || "",
    },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.details || res.statusText);
  }
  return res.status === 204 ? null : res.json();
};

/* ── Reloadly Integration (proxied via Supabase Edge Function) ── */
const PROXY = `${SUPABASE_URL}/functions/v1/clever-processor`;

async function rlFetch(product, path, opts={}){
  const res = await fetch(`${PROXY}?product=${product}&path=${encodeURIComponent(path)}`,{
    method: opts.method || "GET",
    headers:{"Content-Type":"application/json"},
    body: opts.body || undefined
  });
  if(!res.ok){
    const e = await res.json().catch(()=>({}));
    throw new Error(e.message||e.errorCode||res.statusText);
  }
  return res.json();
}

const slugify = s => s.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"");
const fmt = n => new Intl.NumberFormat("en-GH",{style:"currency",currency:"GHS",minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
const genOrderId = () => "ORD-" + Math.random().toString(36).slice(2,6).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();

const G = {
  bg:"#0a0f1e", surface:"#111827", card:"#161d30", border:"#1e2d45",
  accent:"#00e5ff", accent2:"#7b61ff", green:"#00d68f", red:"#ff4d6d",
  text:"#e8edf7", muted:"#6b7fa3", gold:"#ffd166"
};

const btnStyle = (v="primary") => ({
  display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6,
  padding:"10px 22px", borderRadius:10, border:"none",
  fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14,
  cursor:"pointer", transition:"all .2s",
  ...(v==="primary" ? {background:`linear-gradient(135deg,${G.accent},${G.accent2})`,color:"#fff"}
    : v==="ghost"   ? {background:"transparent",color:G.text,border:`1px solid ${G.border}`}
    : v==="green"   ? {background:`linear-gradient(135deg,${G.green},#00b37a)`,color:"#fff"}
    :                 {background:G.card,color:G.text,border:`1px solid ${G.border}`})
});

const inputStyle = {
  width:"100%", padding:"11px 14px", background:G.surface,
  border:`1px solid ${G.border}`, borderRadius:9, color:G.text,
  fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", transition:"border .2s"
};

/* ── Toast ── */
function Toast({msg,type}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,
    background:type==="error"?G.red:G.green,color:"#fff",padding:"12px 20px",
    borderRadius:12,fontWeight:600,fontSize:14,boxShadow:"0 8px 32px rgba(0,0,0,.4)",
    maxWidth:320,animation:"fadeUp .3s ease"}}>{msg}</div>;
}

/* ── StatCard ── */
function StatCard({icon,label,value,sub,color,delay}){
  return(
    <div className={`fade-up ${delay}`} style={{
      background:`linear-gradient(135deg, rgba(22,29,48,0.9) 0%, rgba(17,24,39,0.95) 100%)`,
      border:`1px solid ${color}25`,
      borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:7,
      position:"relative",overflow:"hidden",
      boxShadow:`0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`}}>
      <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,
        background:`${color}15`,borderRadius:"50%",filter:"blur(20px)"}}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg,transparent,${color}40,transparent)`}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{width:34,height:34,background:`linear-gradient(135deg,${color}25,${color}15)`,
          borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
          border:`1px solid ${color}30`}}>{icon}</div>
        {sub && <div style={{fontSize:9,color,fontWeight:700,background:`${color}15`,
          padding:"3px 8px",borderRadius:20,letterSpacing:0.3,border:`1px solid ${color}25`}}>{sub}</div>}
      </div>
      <div>
        <div style={{color:G.muted,fontSize:10,marginBottom:3,fontWeight:500,letterSpacing:0.3}}>{label}</div>
        <div className="syne" style={{fontWeight:800,fontSize:19,color:G.text,lineHeight:1}}>{value}</div>
      </div>
    </div>
  );
}

/* ── Landing ── */
function Landing({onSignup, onLogin, onSecretTap}){
  const [liveStats, setLiveStats] = useState({resellers:0, txns:0, loaded:false});
  const [buyModal, setBuyModal] = useState(null); // {label, price}
  const [buyPhone, setBuyPhone] = useState("");
  const [buyEmail, setBuyEmail] = useState("");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyDone, setBuyDone] = useState(null);
  const [buyToast, setBuyToast] = useState({msg:"",type:""});

  const PAYSTACK_PK = "pk_live_d093131f6a1823be2cf892e9378027de29ddc7b1";
  const PLATFORM_RESELLER_ID = null; // orders go directly, no specific reseller

  const showBuyToast=(msg,type="success")=>{
    setBuyToast({msg,type}); setTimeout(()=>setBuyToast({msg:"",type:""}),3500);
  };

  const handleDirectBuy = ()=>{
    if(!buyPhone.trim()){ showBuyToast("Enter your phone number","error"); return; }
    if(!window.PaystackPop){ showBuyToast("Payment system not loaded","error"); return; }
    setBuyBusy(true);
    const ref = "_DIRECT_"+Date.now();
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PK,
      email: buyEmail || "customer@dataresell.pro",
      amount: Math.round(buyModal.price * 100),
      currency: "GHS",
      ref,
      metadata:{custom_fields:[{display_name:"Bundle",variable_name:"bundle",value:buyModal.label+" MTN Data"},{display_name:"Phone",variable_name:"phone",value:buyPhone}]},
      callback: async(response)=>{
        const orderId = genOrderId();
        try{
          await sb("transactions",{method:"POST",prefer:"return=representation",
            body:JSON.stringify({reseller_id:null,network:"MTN",bundle:buyModal.label+" MTN Data - GHS"+buyModal.price.toFixed(2),amount:buyModal.price,customer_phone:buyPhone,customer_email:buyEmail||null,status:"pending",type:"data_purchase",payment_ref:response.reference,order_ref:orderId})});
        }catch(e){ console.warn("Order log failed",e); }
        setBuyDone({orderId, bundle:buyModal.label+" MTN Data", phone:buyPhone, amount:buyModal.price});
        setBuyBusy(false);
      },
      onClose:()=>{ showBuyToast("Payment cancelled","error"); setBuyBusy(false); }
    });
    handler.openIframe();
  };

  useEffect(()=>{
    Promise.all([
      sb("resellers?select=id").catch(()=>[]),
      sb("transactions?select=id&status=eq.success").catch(()=>[])
    ]).then(([resellers, txns])=>{
      setLiveStats({resellers:resellers.length||0, txns:txns.length||0, loaded:true});
    }).catch(()=>{});
  },[]);

  const steps=[
    "Create a free account",
    "Enter your Store Name, Phone Number, and Password",
    "Instantly receive your personal reseller dashboard",
    "Get your unique store link to share with customers",
    "Sell data bundles and earn profits"
  ];
  const benefits=[
    {icon:"🆓",title:"Free Account",desc:"Zero cost to get started"},
    {icon:"⚡",title:"Instant Dashboard",desc:"Access your panel immediately"},
    {icon:"🔗",title:"Personal Store Link",desc:"Your own branded URL"},
    {icon:"🚀",title:"Fast Transactions",desc:"Lightning-fast data delivery"},
    {icon:"📊",title:"Easy Management",desc:"Track sales in one place"},
    {icon:"📱",title:"Mobile Friendly",desc:"Optimised for phones"},
  ];

  // Base prices for the public pricing section
  const mtnBundles = [
    {label:"1GB",price:4.40},{label:"2GB",price:8.70},{label:"3GB",price:12.80},
    {label:"4GB",price:17.00},{label:"5GB",price:22.00},{label:"10GB",price:41.00},
    {label:"25GB",price:98.00},{label:"50GB",price:193.00},
  ];

  return(
    <div style={{minHeight:"100vh"}}>
      <Toast msg={buyToast.msg} type={buyToast.type}/>

      {/* ── Direct Buy Modal ── */}
      {buyModal&&!buyDone&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}
          onClick={e=>{if(e.target===e.currentTarget)setBuyModal(null);}}>
          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:"24px 24px 0 0",
            padding:"28px 24px 36px",width:"100%",maxWidth:480,animation:"slideUp .3s ease"}}>
            <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:4,margin:"0 auto 20px"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div className="syne" style={{fontWeight:800,fontSize:22,color:G.gold}}>{buyModal.label} MTN Data</div>
                <div style={{fontSize:13,color:G.muted,marginTop:2}}>Instant delivery · Valid 30 days</div>
              </div>
              <div className="syne" style={{fontWeight:800,fontSize:22,color:G.text}}>GHS {buyModal.price.toFixed(2)}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              <div>
                <div style={{fontSize:11,color:G.muted,fontWeight:600,letterSpacing:0.4,marginBottom:6}}>RECIPIENT PHONE NUMBER *</div>
                <input value={buyPhone} onChange={e=>setBuyPhone(e.target.value)}
                  style={{...inputStyle,fontSize:15}}
                  placeholder="e.g. 0241234567"
                  onFocus={e=>e.target.style.borderColor=G.gold}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
              </div>
              <div>
                <div style={{fontSize:11,color:G.muted,fontWeight:600,letterSpacing:0.4,marginBottom:6}}>EMAIL (optional – for receipt)</div>
                <input value={buyEmail} onChange={e=>setBuyEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="e.g. you@email.com"
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
              </div>
            </div>
            <button onClick={handleDirectBuy} disabled={buyBusy}
              style={{width:"100%",padding:"16px",borderRadius:14,border:"none",
                background:`linear-gradient(135deg,${G.gold},#ff9a3c)`,
                color:"#000",fontWeight:800,fontSize:16,cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                opacity:buyBusy?0.7:1}}>
              {buyBusy?<><span className="spinner"/>Processing…</>:<>💳 Pay GHS {buyModal.price.toFixed(2)}</>}
            </button>
            <button onClick={()=>setBuyModal(null)}
              style={{width:"100%",marginTop:10,background:"none",border:"none",color:G.muted,
                fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:500}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Buy Success Modal ── */}
      {buyDone&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:G.card,border:`1px solid ${G.green}40`,borderRadius:24,padding:"32px 24px",width:"100%",maxWidth:400,textAlign:"center"}}>
            <div style={{fontSize:64,marginBottom:12,animation:"pulse 1s infinite"}}>🎉</div>
            <div className="syne" style={{fontWeight:800,fontSize:24,color:G.text,marginBottom:6}}>Order Placed!</div>
            <div style={{color:G.muted,fontSize:14,marginBottom:20}}>Your data bundle is being processed.</div>
            <div style={{background:"rgba(0,229,255,0.08)",border:"1.5px dashed rgba(0,229,255,0.35)",borderRadius:14,padding:"14px 18px",marginBottom:20,cursor:"pointer"}}
              onClick={()=>navigator.clipboard.writeText(buyDone.orderId).then(()=>showBuyToast("Order ID copied!"))}>
              <div style={{fontSize:11,color:G.muted,fontWeight:600,letterSpacing:0.5,marginBottom:4}}>ORDER ID — tap to copy</div>
              <div className="syne" style={{fontWeight:900,fontSize:20,color:G.accent}}>{buyDone.orderId}</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${G.border}`,borderRadius:14,padding:"14px 16px",marginBottom:20,textAlign:"left"}}>
              <div style={{fontSize:11,color:G.muted,fontWeight:600,marginBottom:2}}>BUNDLE</div>
              <div style={{fontWeight:700,color:G.text,marginBottom:10}}>{buyDone.bundle}</div>
              <div style={{fontSize:11,color:G.muted,fontWeight:600,marginBottom:2}}>RECIPIENT</div>
              <div style={{fontWeight:700,color:G.accent,marginBottom:10}}>{buyDone.phone}</div>
              <div style={{fontSize:11,color:G.muted,fontWeight:600,marginBottom:2}}>AMOUNT PAID</div>
              <div className="syne" style={{fontWeight:800,fontSize:20,color:G.green}}>GHS {buyDone.amount.toFixed(2)}</div>
            </div>
            <button onClick={()=>{ setBuyDone(null); setBuyModal(null); }}
              style={{width:"100%",padding:"13px",borderRadius:12,border:"none",
                background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
                color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{padding:"14px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",borderBottom:`1px solid ${G.border}`,
        background:`${G.bg}ee`,backdropFilter:"blur(12px)",
        position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}} onClick={onSecretTap} style={{cursor:"default",userSelect:"none"}}>
          <div style={{width:30,height:30,background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
            borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:900,fontSize:14,color:"#fff"}}>D</div>
          <div className="syne" style={{fontWeight:800,fontSize:17,
            background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
            WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DataResell Pro</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={{...btnStyle("ghost"),padding:"8px 16px",fontSize:13}} onClick={onLogin}>Login</button>
          <button style={{...btnStyle("primary"),padding:"8px 18px",fontSize:13}} onClick={onSignup}>Get Started →</button>
        </div>
      </nav>

      {/* Hero — compact */}
      <div style={{position:"relative",padding:"52px 20px 56px",textAlign:"center",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 70% 50% at 50% -10%,${G.accent}14,transparent)`}}/>
        <div style={{position:"absolute",top:"20%",left:"5%",width:240,height:240,
          background:`${G.accent2}10`,borderRadius:"50%",filter:"blur(70px)"}}/>
        <div style={{position:"absolute",top:"30%",right:"5%",width:160,height:160,
          background:`${G.accent}08`,borderRadius:"50%",filter:"blur(50px)"}}/>
        <div style={{position:"relative",maxWidth:600,margin:"0 auto"}}>
          <div className="fade-up fa1" style={{display:"inline-block",
            background:`${G.accent}18`,border:`1px solid ${G.accent}40`,
            color:G.accent,padding:"5px 14px",borderRadius:100,fontSize:12,
            fontWeight:600,marginBottom:18}}>🚀 #1 Data Reseller Platform in Ghana</div>
          <h1 className="syne fade-up fa2" style={{fontSize:"clamp(26px,5.5vw,46px)",
            fontWeight:800,lineHeight:1.15,marginBottom:14}}>
            Start Your Own{" "}
            <span style={{background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Data Reselling Business
            </span>
          </h1>
          <p className="fade-up fa3" style={{fontSize:15,color:G.muted,lineHeight:1.65,
            marginBottom:28,maxWidth:460,margin:"0 auto 28px"}}>
            Launch your personal data store in minutes. No technical skills needed.
          </p>
          <div className="fade-up fa4 hero-btns" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button style={{...btnStyle("primary"),fontSize:14,padding:"12px 30px",animation:"glow 2s infinite"}}
              onClick={onSignup}>Create Free Account</button>
            <button style={{...btnStyle("ghost"),fontSize:14,padding:"12px 24px"}}
              onClick={()=>document.getElementById("prices").scrollIntoView({behavior:"smooth"})}>
              📶 View Data Prices
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Stats Bar ── */}
      <div style={{padding:"0 16px 32px",maxWidth:700,margin:"0 auto"}}>
        <div className="live-stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
          {[
            {icon:"👥",label:"Active Resellers",value:liveStats.loaded?(liveStats.resellers>0?liveStats.resellers.toLocaleString():"0"):"…",color:G.accent},
            {icon:"✅",label:"Bundles Delivered",value:liveStats.loaded?(liveStats.txns>0?liveStats.txns.toLocaleString()+"+":`0`):"…",color:G.green},
            {icon:"🌐",label:"Networks",value:"3",color:G.gold},
            {icon:"⏱️",label:"Avg Delivery",value:"Instant",color:G.accent2},
          ].map((s,i)=>(
            <div key={i} className={`fade-up fa${i+2}`}
              style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
                padding:"14px 16px",textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`${s.color}06`}}/>
              <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
              <div className="syne" style={{fontWeight:800,fontSize:20,color:s.color,lineHeight:1,marginBottom:4}}>
                {s.value}
              </div>
              <div style={{fontSize:11,color:G.muted,fontWeight:500,lineHeight:1.3}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Buy Data Highlight Card ── */}
      <div style={{padding:"0 20px 40px",maxWidth:700,margin:"0 auto"}}>
        <div className="fade-up fa5 buy-highlight-inner" onClick={()=>document.getElementById("prices").scrollIntoView({behavior:"smooth"})}
          style={{background:`linear-gradient(135deg,${G.accent}18,${G.accent2}14)`,
            border:`1.5px solid ${G.accent}35`,borderRadius:20,padding:"20px 24px",
            display:"flex",alignItems:"center",justifyContent:"space-between",
            cursor:"pointer",transition:"transform .2s, box-shadow .2s",gap:14,
            boxShadow:`0 0 40px ${G.accent}10`}}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 12px 40px ${G.accent}25`;}}
          onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 0 40px ${G.accent}10`;}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{width:52,height:52,background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
              borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:24,flexShrink:0,boxShadow:`0 4px 20px ${G.accent}40`}}>📶</div>
            <div>
              <div className="syne" style={{fontWeight:800,fontSize:17,color:G.text,marginBottom:3}}>Buy Data Bundles</div>
              <div style={{fontSize:13,color:G.muted}}>MTN from GHS 4.40 · Instant delivery · All networks</div>
            </div>
          </div>
          <div className="buy-view-btn" style={{display:"flex",alignItems:"center",gap:6,background:G.accent+"22",
            borderRadius:12,padding:"8px 14px",flexShrink:0}}>
            <span style={{fontSize:13,fontWeight:700,color:G.accent}}>View Prices</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 11l4-4-4-4" stroke={G.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Base Prices Section ── */}
      <div id="prices" style={{padding:"40px 20px 48px",background:`${G.surface}66`}}>
        <div style={{maxWidth:700,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{display:"inline-block",background:`${G.accent}18`,border:`1px solid ${G.accent}35`,
              color:G.accent,padding:"4px 14px",borderRadius:100,fontSize:11,fontWeight:700,
              marginBottom:12,letterSpacing:0.5}}>📶 CURRENT PRICES</div>
            <h2 className="syne" style={{fontSize:26,fontWeight:800,marginBottom:6}}>Data Bundle Prices</h2>
            <p style={{color:G.muted,fontSize:13}}>MTN Ghana · Base reseller prices · Valid 30 days</p>
          </div>

          <div className="mtn-prices-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:20}}>
            {mtnBundles.map((b,i)=>(
              <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
                padding:"14px 16px",textAlign:"center",transition:"border .2s, transform .2s",cursor:"pointer",display:"flex",flexDirection:"column",gap:6}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=G.gold+"70";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.transform="none";}}>
                <div className="syne" style={{fontWeight:800,fontSize:18,color:G.gold}}>{b.label}</div>
                <div style={{fontSize:11,color:G.muted}}>MTN Data</div>
                <div style={{background:`${G.gold}15`,borderRadius:8,padding:"5px 0"}}>
                  <span className="syne" style={{fontWeight:800,fontSize:15,color:G.text}}>GHS {b.price.toFixed(2)}</span>
                </div>
                <button
                  onClick={()=>{ setBuyModal(b); setBuyPhone(""); setBuyEmail(""); setBuyDone(null); }}
                  style={{marginTop:4,width:"100%",padding:"7px 0",borderRadius:8,border:"none",
                    background:`linear-gradient(135deg,${G.gold},#ff9a3c)`,
                    color:"#000",fontWeight:800,fontSize:12,cursor:"pointer",
                    fontFamily:"'DM Sans',sans-serif",letterSpacing:0.2}}>
                  Buy Now
                </button>
              </div>
            ))}
          </div>

          <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
            padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",
            flexWrap:"wrap",gap:10,marginBottom:24}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>ℹ️</span>
              <div>
                <div style={{fontWeight:600,fontSize:13,color:G.text}}>Resellers set their own selling prices</div>
                <div style={{fontSize:12,color:G.muted}}>Prices above are base cost. Your profit = your price − base cost.</div>
              </div>
            </div>
            <button style={{...btnStyle("primary"),padding:"9px 18px",fontSize:13}} onClick={onSignup}>
              Start Reselling →
            </button>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",
            background:`${G.accent2}10`,border:`1px solid ${G.accent2}25`,borderRadius:14,padding:"12px 16px"}}>
            {[["MTN","#FFCD00"],["AirtelTigo","#FF3B30"],["Telecel","#007AFF"]].map(([net,col])=>(
              <div key={net} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:col}}/>
                <span style={{fontSize:12,color:G.muted,fontWeight:500}}>{net}</span>
                {net!=="MTN"&&<span style={{fontSize:10,color:G.muted,background:`${G.muted}18`,borderRadius:6,padding:"1px 6px"}}>Coming soon</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works — compact */}
      <div id="how" style={{padding:"44px 20px",maxWidth:640,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <h2 className="syne" style={{fontSize:24,fontWeight:800,marginBottom:6}}>How It Works</h2>
          <p style={{color:G.muted,fontSize:13}}>Five simple steps to your reseller business</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"14px 0",
              borderBottom:i<steps.length-1?`1px solid ${G.border}`:"none"}}>
              <div style={{minWidth:36,height:36,background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
                borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:"#fff",flexShrink:0}}>{i+1}</div>
              <div style={{paddingTop:8,fontSize:14,fontWeight:500,color:G.text}}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits — compact grid */}
      <div style={{padding:"40px 20px 44px",background:`${G.surface}66`}}>
        <div style={{maxWidth:800,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <h2 className="syne" style={{fontSize:24,fontWeight:800,marginBottom:6}}>Why Choose Us</h2>
            <p style={{color:G.muted,fontSize:13}}>Everything you need to run a successful data business</p>
          </div>
          <div className="benefits-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
            {benefits.map((b,i)=>(
              <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
                padding:"18px 20px",transition:"border .2s,transform .2s",cursor:"default",
                display:"flex",alignItems:"flex-start",gap:12}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=G.accent+"50";e.currentTarget.style.transform="translateY(-3px)"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.transform="translateY(0)"}}>
                <span style={{fontSize:26,flexShrink:0}}>{b.icon}</span>
                <div>
                  <div className="syne" style={{fontWeight:700,fontSize:14,marginBottom:4}}>{b.title}</div>
                  <div style={{color:G.muted,fontSize:12,lineHeight:1.5}}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA — compact */}
      <div style={{padding:"52px 20px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 60% 60% at 50% 50%,${G.accent2}12,transparent)`}}/>
        <div style={{position:"relative",maxWidth:500,margin:"0 auto"}}>
          <h2 className="syne" style={{fontSize:"clamp(22px,4.5vw,38px)",fontWeight:800,marginBottom:10}}>Ready to Start Earning?</h2>
          <p style={{color:G.muted,fontSize:14,marginBottom:28}}>Join resellers making money with DataResell Pro across Ghana</p>
          <div className="cta-btns" style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button style={{...btnStyle("primary"),fontSize:15,padding:"13px 36px",animation:"glow 2s infinite"}}
              onClick={onSignup}>Create Your Free Account →</button>
            <button style={{...btnStyle("ghost"),fontSize:15,padding:"13px 28px"}}
              onClick={onLogin}>Login to Dashboard</button>
          </div>
        </div>
      </div>

      <footer style={{borderTop:`1px solid ${G.border}`,padding:"16px 20px",textAlign:"center",color:G.muted,fontSize:12}}>
        © 2025 DataResell Pro Ghana · All rights reserved
      </footer>
    </div>
  );
}

/* ── Auth Modal (Signup + Login tabs) ── */
function AuthModal({defaultTab="signup", onSuccess, onClose}){
  const [tab, setTab] = useState(defaultTab);
  const [signupForm, setSignupForm] = useState({store_name:"",phone_number:"",password:""});
  const [loginForm, setLoginForm] = useState({phone_number:"",password:""});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");
    if(!signupForm.store_name.trim()||!signupForm.phone_number.trim()||!signupForm.password.trim()){
      setError("All fields are required."); return;
    }
    if(signupForm.password.length<6){setError("Password must be at least 6 characters."); return;}
    setLoading(true);
    try{
      const slug = slugify(signupForm.store_name);
      const existing = await sb(`resellers?store_slug=eq.${slug}&select=id`);
      const finalSlug = existing.length ? `${slug}${Date.now().toString().slice(-4)}` : slug;
      const [reseller] = await sb("resellers?select=*",{
        method:"POST", prefer:"return=representation",
        body:JSON.stringify({
          store_name:signupForm.store_name.trim(),
          phone_number:signupForm.phone_number.trim(),
          password:signupForm.password,
          store_slug:finalSlug,
          wallet_balance:0, total_sales:0, total_customers:0
        })
      });
      onSuccess(reseller);
    }catch(e){
      setError(e.message||"Something went wrong. Try again.");
    }finally{ setLoading(false); }
  };

  const handleLogin = async () => {
    setError("");
    if(!loginForm.phone_number.trim()||!loginForm.password.trim()){
      setError("Phone number and password are required."); return;
    }
    setLoading(true);
    try{
      const results = await sb(
        `resellers?phone_number=eq.${encodeURIComponent(loginForm.phone_number.trim())}&password=eq.${encodeURIComponent(loginForm.password)}&select=*`
      );
      if(!results||results.length===0){
        setError("Invalid phone number or password."); return;
      }
      onSuccess(results[0]);
    }catch(e){
      setError(e.message||"Login failed. Try again.");
    }finally{ setLoading(false); }
  };

  const tabBtn = (id, label) => (
    <button onClick={()=>{setTab(id);setError("");}}
      style={{flex:1,padding:"11px",border:"none",borderRadius:10,cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:14,transition:"all .2s",
        background:tab===id?`linear-gradient(135deg,${G.accent},${G.accent2})`:"transparent",
        color:tab===id?"#fff":G.muted}}>
      {label}
    </button>
  );

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",backdropFilter:"blur(8px)",
      zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div className="auth-modal-inner" style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:20,
        padding:36,width:"100%",maxWidth:440,position:"relative",animation:"fadeUp .3s ease"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22,lineHeight:1}}>✕</button>

        {/* Logo */}
        <div className="syne" style={{fontWeight:800,fontSize:22,textAlign:"center",marginBottom:20,
          background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DataResell Pro</div>

        {/* Tab switcher */}
        <div style={{display:"flex",background:G.surface,borderRadius:12,padding:4,marginBottom:28,
          border:`1px solid ${G.border}`}}>
          {tabBtn("signup","Create Account")}
          {tabBtn("login","Login")}
        </div>

        {error && <div style={{background:`${G.red}22`,border:`1px solid ${G.red}50`,color:G.red,
          padding:"10px 14px",borderRadius:10,fontSize:14,marginBottom:18}}>{error}</div>}

        {/* SIGNUP FORM */}
        {tab==="signup" && (
          <>
            <p style={{color:G.muted,fontSize:14,marginBottom:20}}>Your dashboard is ready in seconds</p>
            {[
              {k:"store_name",label:"Store Name",ph:"e.g. John Data Hub",type:"text"},
              {k:"phone_number",label:"Phone Number",ph:"e.g. 0244123456",type:"tel"},
              {k:"password",label:"Password",ph:"Min. 6 characters",type:"password"},
            ].map(f=>(
              <div key={f.k} style={{marginBottom:18}}>
                <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>{f.label}</label>
                <input style={inputStyle} type={f.type} placeholder={f.ph}
                  value={signupForm[f.k]} onChange={e=>setSignupForm(p=>({...p,[f.k]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleSignup()}
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
                {f.k==="store_name"&&signupForm.store_name&&(
                  <div style={{fontSize:12,color:G.accent,marginTop:5}}>
                    Your link: <strong>{window.location.origin}/store/{slugify(signupForm.store_name)}</strong>
                  </div>
                )}
              </div>
            ))}
            <button style={{...btnStyle("primary"),width:"100%",padding:15,fontSize:16,marginTop:8}}
              onClick={handleSignup} disabled={loading}>
              {loading ? <><span className="spinner"/> Creating Account…</> : "Create Account →"}
            </button>
            <p style={{textAlign:"center",color:G.muted,fontSize:13,marginTop:16}}>No email or OTP required · Instant access</p>
          </>
        )}

        {/* LOGIN FORM */}
        {tab==="login" && (
          <>
            <p style={{color:G.muted,fontSize:14,marginBottom:20}}>Welcome back! Sign in to your dashboard</p>
            {[
              {k:"phone_number",label:"Phone Number",ph:"e.g. 0244123456",type:"tel"},
              {k:"password",label:"Password",ph:"Your password",type:"password"},
            ].map(f=>(
              <div key={f.k} style={{marginBottom:18}}>
                <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>{f.label}</label>
                <input style={inputStyle} type={f.type} placeholder={f.ph}
                  value={loginForm[f.k]} onChange={e=>setLoginForm(p=>({...p,[f.k]:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
              </div>
            ))}
            <button style={{...btnStyle("primary"),width:"100%",padding:15,fontSize:16,marginTop:8}}
              onClick={handleLogin} disabled={loading}>
              {loading ? <><span className="spinner"/> Logging in…</> : "Login to Dashboard →"}
            </button>
            <p style={{textAlign:"center",color:G.muted,fontSize:13,marginTop:16}}>
              No account?{" "}
              <span style={{color:G.accent,cursor:"pointer",fontWeight:600}}
                onClick={()=>{setTab("signup");setError("");}}>Create one free →</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Reseller Inbox / Notifications Tab ── */
function ResellerNotificationsTab({reseller, showToast}){
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState([]);
  const [activeInboxTab, setActiveInboxTab] = useState("broadcasts");

  const fetchNotifs = async()=>{
    setLoading(true);
    try{
      const [data, reqs] = await Promise.all([
        sb(`notifications?reseller_id=eq.${reseller.id}&order=sent_at.desc&select=*`),
        sb(`reseller_requests?reseller_id=eq.${reseller.id}&order=created_at.desc&select=*`).catch(()=>[])
      ]);
      setNotifs(data||[]);
      setMyRequests(reqs||[]);
    }catch(e){ showToast("Could not load inbox: "+e.message,"error"); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ fetchNotifs(); },[reseller.id]);

  const markRead = async(id)=>{
    try{
      await sb(`notifications?id=eq.${id}`,{method:"PATCH",prefer:"return=representation",body:JSON.stringify({read:true})});
      setNotifs(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
    }catch{}
  };

  const markAllRead = async()=>{
    const unread = notifs.filter(n=>!n.read);
    try{
      await Promise.all(unread.map(n=>sb(`notifications?id=eq.${n.id}`,{method:"PATCH",prefer:"return=representation",body:JSON.stringify({read:true})})));
      setNotifs(prev=>prev.map(n=>({...n,read:true})));
      showToast("All marked as read");
    }catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const unreadCount = notifs.filter(n=>!n.read).length;
  const reqStatusColors = {Pending:"#ffd166",Under_Review:"#00e5ff",Approved:"#00d68f",Rejected:"#ff4d6d",Implemented:"#7b61ff"};

  return(
    <div>
      {/* Inbox header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:20,display:"flex",alignItems:"center",gap:10}}>
            📬 Inbox
            {unreadCount>0&&<span style={{background:`linear-gradient(135deg,${G.accent2},${G.accent})`,color:"#fff",borderRadius:20,fontSize:11,fontWeight:800,padding:"3px 10px",boxShadow:`0 0 12px ${G.accent}50`}}>{unreadCount} unread</span>}
          </div>
          <div style={{color:G.muted,fontSize:12,marginTop:2}}>Messages, broadcasts & suggestion replies</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {unreadCount>0&&activeInboxTab==="broadcasts"&&(
            <button style={{...btnStyle("ghost"),padding:"7px 14px",fontSize:12}} onClick={markAllRead}>✓ Mark all read</button>
          )}
          <button style={{...btnStyle("ghost"),padding:"7px 14px",fontSize:12}} onClick={fetchNotifs}>
            {loading?<span className="spinner"/>:"↻"}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:6,marginBottom:18,background:G.surface,borderRadius:12,padding:5,border:`1px solid ${G.border}`}}>
        {[
          {id:"broadcasts",label:"📢 Broadcasts",count:unreadCount},
          {id:"replies",label:"💬 My Requests",count:myRequests.filter(r=>r.admin_note&&(r.status||"Pending")!=="Pending").length}
        ].map(t=>(
          <button key={t.id} onClick={()=>setActiveInboxTab(t.id)}
            style={{flex:1,padding:"9px 12px",borderRadius:9,border:"none",cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,transition:"all .2s",
              background:activeInboxTab===t.id?`linear-gradient(135deg,${G.accent2}30,${G.accent}20)`:
                "transparent",
              color:activeInboxTab===t.id?G.accent:G.muted,
              borderBottom:activeInboxTab===t.id?`2px solid ${G.accent}`:"2px solid transparent"}}>
            {t.label}
            {t.count>0&&<span style={{marginLeft:6,background:G.accent2,color:"#fff",borderRadius:20,fontSize:9,fontWeight:800,padding:"1px 6px"}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:"48px",color:G.muted}}>
          <span className="spinner" style={{width:28,height:28,borderTopColor:G.accent}}/>
        </div>
      ):activeInboxTab==="broadcasts"?(
        notifs.length===0?(
          <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
            background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
            <div style={{fontSize:48,marginBottom:12}}>📭</div>
            <div style={{fontSize:15,fontWeight:600}}>No broadcasts yet</div>
            <div style={{fontSize:13,marginTop:6}}>Admin announcements will appear here</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {notifs.map((n,i)=>(
              <div key={n.id||i}
                onClick={()=>{ if(!n.read) markRead(n.id); }}
                style={{background:n.read?G.card:`linear-gradient(135deg,${G.accent2}10,${G.accent}06)`,
                  border:`1px solid ${n.read?G.border:G.accent2+"50"}`,
                  borderRadius:14,padding:"16px 18px",cursor:n.read?"default":"pointer",
                  transition:"all .2s",position:"relative",overflow:"hidden"}}>
                {!n.read&&(
                  <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",
                    background:`linear-gradient(180deg,${G.accent2},${G.accent})`,borderRadius:"14px 0 0 14px"}}/>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,background:n.read?`${G.muted}15`:`${G.accent2}22`,borderRadius:10,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,
                      boxShadow:n.read?"none":`0 0 12px ${G.accent2}30`}}>📢</div>
                    <div>
                      <div style={{fontWeight:n.read?500:700,fontSize:14,color:G.text}}>Admin Broadcast</div>
                      <div style={{fontSize:11,color:G.muted}}>{n.sent_at?new Date(n.sent_at).toLocaleString("en-GH",{dateStyle:"medium",timeStyle:"short"}):""}</div>
                    </div>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,flexShrink:0,
                    background:n.read?`${G.muted}18`:`${G.accent2}22`,color:n.read?G.muted:G.accent2,
                    border:`1px solid ${n.read?G.muted+"20":G.accent2+"40"}`}}>
                    {n.read?"Read":"New"}
                  </span>
                </div>
                <div style={{fontSize:14,color:n.read?G.muted:G.text,lineHeight:1.65,paddingLeft:46}}>
                  {n.message}
                </div>
                {!n.read&&(
                  <div style={{paddingLeft:46,marginTop:8}}>
                    <span style={{fontSize:11,color:G.accent,fontWeight:600}}>Tap to mark as read ✓</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ):(
        /* Replies tab — show my submissions with admin replies */
        myRequests.length===0?(
          <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
            background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
            <div style={{fontSize:48,marginBottom:12}}>💬</div>
            <div style={{fontSize:15,fontWeight:600}}>No submissions yet</div>
            <div style={{fontSize:13,marginTop:6}}>Submit a suggestion from the Requests tab</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {myRequests.map((req,i)=>{
              const st = req.status||"Pending";
              const stColor = reqStatusColors[st]||G.muted;
              const hasReply = req.admin_note;
              return(
                <div key={req.id||i} style={{background:hasReply?`linear-gradient(135deg,${G.green}08,${G.card})`:G.card,
                  border:`1px solid ${hasReply?G.green+"40":G.border}`,borderRadius:14,padding:"16px 18px",
                  position:"relative",overflow:"hidden"}}>
                  {hasReply&&<div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:G.green,borderRadius:"14px 0 0 14px"}}/>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10,flexWrap:"wrap"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                        <span style={{fontSize:15}}>{req.type==="request"?"🛍️":"💡"}</span>
                        <span style={{fontWeight:700,fontSize:14,color:G.text}}>{req.title}</span>
                      </div>
                      <div style={{fontSize:11,color:G.muted}}>{req.created_at?new Date(req.created_at).toLocaleDateString("en-GH",{dateStyle:"medium"}):""}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:20,
                      background:`${stColor}22`,color:stColor,border:`1px solid ${stColor}40`,flexShrink:0}}>
                      {st.replace("_"," ")}
                    </span>
                  </div>
                  <div style={{fontSize:13,color:G.muted,lineHeight:1.6,background:G.surface,borderRadius:8,padding:"10px 12px",marginBottom:hasReply?10:0}}>
                    {req.details}
                  </div>
                  {hasReply&&(
                    <div style={{background:`${G.green}12`,border:`1px solid ${G.green}30`,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{width:28,height:28,background:`${G.gold}22`,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🛡️</div>
                      <div>
                        <div style={{fontSize:11,fontWeight:700,color:G.gold,marginBottom:4,letterSpacing:0.3}}>ADMIN REPLY</div>
                        <div style={{fontSize:13,color:G.text,lineHeight:1.6}}>{req.admin_note}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ── Dashboard ── */
function Dashboard({reseller:init,onLogout}){
  const [reseller,setReseller]=useState(init);
  const [txns,setTxns]=useState([]);
  const [copied,setCopied]=useState(false);
  const [toast,setToast]=useState({msg:"",type:""});
  const [buyForm,setBuyForm]=useState({network:"MTN",bundle:"",customer_phone:""});
  const [buying,setBuying]=useState(false);
  const [tab,setTab]=useState("overview");

  // Per-reseller custom prices — loaded from Supabase
  const [myPrices,setMyPrices]   = useState({});
  const [savingPrices,setSavingPrices] = useState(false);
  const [pricesLoaded,setPricesLoaded] = useState(false);

  // Withdrawal state
  const [withdrawals,setWithdrawals] = useState([]);
  const [wdForm,setWdForm] = useState({amount:"",momo_number:"",momo_name:"",note:""});
  const [wdLoading,setWdLoading] = useState(false);

  // Notifications
  const [unreadNotifCount,setUnreadNotifCount] = useState(0);

  const storeUrl = `${window.location.origin}/store/${reseller.store_slug}`;

  const showToast=(msg,type="success")=>{
    setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:""}),3000);
  };

  const fetchData = useCallback(async()=>{
    try{
      const [t,[r],wd,notifs] = await Promise.all([
        sb(`transactions?reseller_id=eq.${reseller.id}&order=created_at.desc&limit=20&select=*`),
        sb(`resellers?id=eq.${reseller.id}&select=*`),
        sb(`withdrawal_requests?reseller_id=eq.${reseller.id}&order=created_at.desc&select=*`).catch(()=>[]),
        sb(`notifications?reseller_id=eq.${reseller.id}&read=eq.false&select=id`).catch(()=>[])
      ]);
      setTxns(t); if(r) setReseller(r);
      setWithdrawals(wd||[]);
      setUnreadNotifCount((notifs||[]).length);
    }catch{}
  },[reseller.id]);

  useEffect(()=>{fetchData(); const i=setInterval(fetchData,30000); return()=>clearInterval(i);},[fetchData]);

  const copyLink=()=>{
    navigator.clipboard.writeText(storeUrl).then(()=>{
      setCopied(true); showToast("Store link copied!");
      setTimeout(()=>setCopied(false),2000);
    });
  };

  // Selling price = custom override OR base cost price
  const getSellingPrice = (bundle) => {
    const v = myPrices[bundle.id];
    return (v && parseFloat(v) > 0) ? parseFloat(v) : bundle.base;
  };

  // Build bundle dropdown options using reseller's custom prices
  const bundles = Object.fromEntries(
    Object.entries(BASE_BUNDLES).map(([net,blist])=>[
      net,
      blist.map(b => b.label + " - GHS" + getSellingPrice(b).toFixed(2))
    ])
  );

  const handleBuy = async()=>{
    if(!buyForm.customer_phone||!buyForm.bundle){showToast("Fill all fields","error");return;}
    const amount=parseFloat((buyForm.bundle.match(/GHS([\d.]+)/)?.[1]||"0"));
    if((reseller.wallet_balance||0)<amount){showToast("Insufficient wallet balance","error");return;}
    setBuying(true);
    try{
      await sb(`resellers?id=eq.${reseller.id}`,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({
          wallet_balance:(reseller.wallet_balance||0)-amount,
          total_sales:(reseller.total_sales||0)+amount,
          total_customers:(reseller.total_customers||0)+1
        })});
      await sb("transactions",{method:"POST",prefer:"return=representation",
        body:JSON.stringify({
          reseller_id:reseller.id, network:buyForm.network,
          bundle:buyForm.bundle, amount, customer_phone:buyForm.customer_phone,
          status:"success", type:"data_purchase"
        })});
      showToast(`✅ ${buyForm.bundle.split(" -")[0]} sent to ${buyForm.customer_phone}`);
      setBuyForm(p=>({...p,bundle:"",customer_phone:""}));
      fetchData();
    }catch(e){ showToast(e.message||"Transaction failed","error"); }
    finally{ setBuying(false); }
  };

  const fundWallet=async()=>{
    try{
      await sb(`resellers?id=eq.${reseller.id}`,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({wallet_balance:(reseller.wallet_balance||0)+50})});
      showToast("GHS 50.00 added to wallet (demo)"); fetchData();
    }catch{ showToast("Failed","error"); }
  };

  // Load prices from Supabase on mount
  useEffect(()=>{
    sb("reseller_prices?reseller_id=eq."+reseller.id+"&select=bundle_id,price")
      .then(rows=>{
        if(rows&&rows.length){
          const map = {};
          rows.forEach(r=>{ map[r.bundle_id] = String(r.price); });
          setMyPrices(map);
        }
        setPricesLoaded(true);
      })
      .catch(()=>setPricesLoaded(true));
  },[reseller.id]);

  const savePrices = async() => {
    setSavingPrices(true);
    try{
      // Upsert each custom price row
      const rows = Object.entries(myPrices)
        .filter(([,v])=>v!==""&&!isNaN(parseFloat(v)))
        .map(([bundle_id,price])=>({reseller_id:reseller.id,bundle_id,price:parseFloat(price)}));
      if(rows.length){
        await sb("reseller_prices",{
          method:"POST",
          prefer:"return=representation,resolution=merge-duplicates",
          body:JSON.stringify(rows)
        });
      }
      // Delete cleared prices
      const cleared = Object.entries(myPrices).filter(([,v])=>v==="").map(([k])=>k);
      for(const bundle_id of cleared){
        await sb("reseller_prices?reseller_id=eq."+reseller.id+"&bundle_id=eq."+bundle_id,{method:"DELETE"});
      }
      showToast("Your prices have been saved!");
    }catch(e){ showToast("Save failed: "+e.message,"error"); }
    finally{ setSavingPrices(false); }
  };

  const setPrice=(id,val)=> setMyPrices(prev=>({...prev,[id]:val}));
  const clearPrice=(id)=>  setMyPrices(prev=>{ const n={...prev}; delete n[id]; return n; });

  // Compute total profit earned (difference between selling price and base cost)
  const totalProfit = txns.filter(t=>t.type==="data_purchase"&&(t.admin_status||"Completed")==="Completed").reduce((sum,t)=>{
    // Try to match bundle to a BASE_BUNDLE to compute cost
    const netBundles = BASE_BUNDLES[t.network]||[];
    const matched = netBundles.find(b=>(t.bundle||"").startsWith(b.label+" "));
    const cost = matched ? matched.base : (t.amount||0);
    const profit = (t.amount||0) - cost;
    return sum + (profit>0?profit:0);
  },0);

  const handleWithdraw = async()=>{
    const amt = parseFloat(wdForm.amount);
    if(isNaN(amt)||amt<=0){showToast("Enter a valid amount","error");return;}
    if(!wdForm.momo_number.trim()){showToast("Enter MoMo number","error");return;}
    if(!wdForm.momo_name.trim()){showToast("Enter account name","error");return;}
    // Withdrawal comes from order earnings (profit), not store wallet balance
    const alreadyWithdrawn = withdrawals.filter(w=>w.status!=="Rejected").reduce((s,w)=>s+(w.amount||0),0);
    const availableEarnings = Math.max(0, totalProfit - alreadyWithdrawn);
    if(availableEarnings < amt){showToast("Insufficient order earnings available","error");return;}
    setWdLoading(true);
    try{
      await sb("withdrawal_requests",{
        method:"POST",prefer:"return=representation",
        body:JSON.stringify({
          reseller_id:reseller.id,
          store_name:reseller.store_name,
          phone_number:reseller.phone_number,
          amount:amt,
          momo_number:wdForm.momo_number.trim(),
          momo_name:wdForm.momo_name.trim(),
          note:wdForm.note.trim()||null,
          status:"Pending"
        })
      });
      showToast("✅ Withdrawal request submitted! Admin will process within 24h.");
      setWdForm({amount:"",momo_number:"",momo_name:"",note:""});
      fetchData();
    }catch(e){showToast("Failed: "+e.message,"error");}
    finally{setWdLoading(false);}
  };

  const navItems=[
    {id:"overview",icon:"📊",label:"Overview"},
    {id:"notifications",icon:"🔔",label:"Notifications"},
    {id:"buy",icon:"📡",label:"Buy Data"},
    {id:"social",icon:"📱",label:"Social Media"},
    {id:"transactions",icon:"📋",label:"Transactions"},
    {id:"earnings",icon:"💹",label:"Earnings"},
    {id:"withdraw",icon:"💸",label:"Withdraw"},
    {id:"pricing",icon:"💲",label:"My Prices"},
    {id:"requests",icon:"💡",label:"Requests"},
    {id:"store",icon:"🔗",label:"My Store"},
  ];
  // Orders tab still accessible via sidebar (desktop) or overview quick-action button
  const allNavItems=[...navItems,{id:"orders",icon:"📦",label:"My Orders"}];

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <Toast msg={toast.msg} type={toast.type}/>

      {/* Header */}
      <header style={{
        background:"rgba(5,7,16,0.95)",
        backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(0,255,198,0.06)",
        boxShadow:"0 2px 20px rgba(0,0,0,0.5)",
        padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:50}}>
        {/* New sleek header */}
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,overflow:"hidden",
            background:`linear-gradient(135deg,#0ff4c6,#7b61ff)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:900,fontSize:16,color:"#fff",
            boxShadow:`0 0 16px rgba(0,255,198,0.4)`}}>G</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,
              background:`linear-gradient(90deg,#0ff4c6,#7b61ff)`,
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-0.3}}>GenData GH</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1.2,fontWeight:700}}>RESELLER HUB</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setTab("notifications")}
            style={{position:"relative",background:"rgba(0,255,198,0.06)",
              border:`1px solid ${unreadNotifCount>0?"rgba(0,255,198,0.4)":"rgba(255,255,255,0.08)"}`,
              borderRadius:10,width:38,height:38,display:"flex",alignItems:"center",
              justifyContent:"center",cursor:"pointer",transition:"all .2s",fontSize:16,
              boxShadow:unreadNotifCount>0?"0 0 12px rgba(0,255,198,0.2)":"none"}}>
            📬
            {unreadNotifCount>0&&(
              <span style={{position:"absolute",top:-5,right:-5,background:"linear-gradient(135deg,#0ff4c6,#7b61ff)",
                color:"#000",borderRadius:20,fontSize:8,fontWeight:900,
                padding:"2px 5px",minWidth:15,textAlign:"center",
                boxShadow:"0 2px 8px rgba(0,0,0,0.5)"}}>
                {unreadNotifCount}
              </span>
            )}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:7,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"4px 12px 4px 5px"}}>
            <div style={{width:28,height:28,background:"linear-gradient(135deg,#0ff4c6,#7b61ff)",
              borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
              fontWeight:900,fontSize:13,color:"#000",flexShrink:0}}>
              {reseller.store_name[0].toUpperCase()}
            </div>
            <span style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.8)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {reseller.store_name}
            </span>
          </div>
          <button style={{padding:"7px 12px",borderRadius:9,border:"1px solid rgba(255,77,109,0.2)",
            background:"rgba(255,77,109,0.07)",color:"#ff4d6d",cursor:"pointer",fontSize:11,fontWeight:700,
            fontFamily:"'DM Sans',sans-serif",transition:"all .2s"}} onClick={onLogout}>Exit</button>
        </div>
      </header>

      <div style={{display:"flex",flex:1,maxWidth:1000,margin:"0 auto",width:"100%",padding:"0 0 72px"}}>
        {/* Redesigned Sidebar */}
        <aside className="sidebar-desktop" style={{width:190,padding:"18px 10px",
          flexDirection:"column",gap:1,flexShrink:0,
          borderRight:"1px solid rgba(255,255,255,0.04)"}}>

          {/* Store badge */}
          <div style={{background:"linear-gradient(135deg,rgba(0,255,198,0.08),rgba(123,97,255,0.08))",
            border:"1px solid rgba(0,255,198,0.15)",borderRadius:14,padding:"12px 14px",marginBottom:18}}>
            <div style={{fontSize:8,color:"rgba(0,255,198,0.6)",fontWeight:700,letterSpacing:1.2,marginBottom:4}}>YOUR STORE</div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:13,color:"#fff",
              marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{reseller.store_name}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:0.5,marginBottom:8}}>{reseller.phone_number}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",fontWeight:600,letterSpacing:0.5}}>WALLET</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,
                  background:"linear-gradient(90deg,#0ff4c6,#00d68f)",
                  WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{fmt(reseller.wallet_balance)}</div>
              </div>
              <button onClick={fundWallet}
                style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(0,255,198,0.3)",
                  background:"rgba(0,255,198,0.1)",color:"#0ff4c6",
                  cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
                + Fund
              </button>
            </div>
          </div>

          {/* Nav items with new styling */}
          {allNavItems.map(n=>{
            const isActive = tab===n.id;
            return(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderRadius:11,
                border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,
                fontWeight:isActive?700:400,
                background:isActive?"linear-gradient(135deg,rgba(0,255,198,0.12),rgba(123,97,255,0.08))"
                  :"transparent",
                color:isActive?"#0ff4c6":"rgba(255,255,255,0.35)",
                transition:"all .2s",textAlign:"left",width:"100%",
                borderLeft:isActive?"2px solid #0ff4c6":"2px solid transparent",
                marginBottom:1}}>
              <span style={{fontSize:14,opacity:isActive?1:0.6}}>{n.icon}</span>
              {n.label}
              {n.id==="notifications"&&unreadNotifCount>0&&(
                <span style={{marginLeft:"auto",background:"linear-gradient(135deg,#0ff4c6,#7b61ff)",
                  color:"#000",borderRadius:20,fontSize:8,fontWeight:900,padding:"2px 6px",minWidth:14,textAlign:"center"}}>{unreadNotifCount}</span>
              )}
            </button>
            );
          })}
        </aside>

        {/* Main Content Area — Redesigned */}
        <main style={{flex:1,padding:"20px 16px",minWidth:0}}>

          {/* Page heading bar */}
          <div className="fade-up fa1" style={{marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:800,lineHeight:1.2,
                background:"linear-gradient(90deg,#fff,rgba(255,255,255,0.6))",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                {tab==="overview"?`Hey, ${reseller.store_name.split(" ")[0]} 👋`
                  :tab==="buy"?"📡 Buy Data Bundle"
                  :tab==="notifications"?"📬 Inbox"
                  :tab==="transactions"?"📋 Transactions"
                  :tab==="earnings"?"💹 Earnings"
                  :tab==="withdraw"?"💸 Withdraw"
                  :tab==="pricing"?"💲 My Prices"
                  :tab==="requests"?"💡 Requests"
                  :tab==="store"?"🔗 My Store"
                  :tab==="social"?"📱 Social Media"
                  :tab==="orders"?"📦 My Orders"
                  :"Dashboard"}
              </h1>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:11,marginTop:2}}>
                {tab==="overview"?"Your business at a glance"
                  :tab==="notifications"?"Broadcasts & replies from admin"
                  :"GenData GH · Reseller Dashboard"}
              </p>
            </div>
            {tab==="overview"&&(
              <button onClick={()=>setTab("buy")}
                style={{padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,
                  background:"linear-gradient(135deg,#0ff4c6,#7b61ff)",color:"#000",
                  boxShadow:"0 4px 20px rgba(0,255,198,0.3)",transition:"all .2s",
                  display:"flex",alignItems:"center",gap:6}}>
                ⚡ Quick Buy
              </button>
            )}
          </div>

          {/* OVERVIEW TAB — Completely Redesigned */}
          {tab==="overview"&&(
            <>
              {/* Stats row — new pill-style cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
                {[
                  {icon:"💳",label:"Wallet",value:fmt(reseller.wallet_balance),color:"#0ff4c6",sub:`${txns.filter(t=>t.type==="data_purchase").length} orders`},
                  {icon:"📈",label:"Total Sales",value:fmt(reseller.total_sales),color:"#7b61ff",sub:"All time revenue"},
                  {icon:"💰",label:"Profit",value:fmt(totalProfit),color:"#ffd166",sub:"Your earnings"},
                  {icon:"👥",label:"Customers",value:String(reseller.total_customers||0),color:"#00d68f",sub:"Served"},
                ].map((s,i)=>(
                  <div key={i} className={`fade-up fa${i+1}`}
                    style={{background:"rgba(255,255,255,0.03)",
                      border:`1px solid ${s.color}20`,borderRadius:16,
                      padding:"14px 16px",position:"relative",overflow:"hidden",
                      transition:"transform .2s",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                    <div style={{position:"absolute",top:-15,right:-15,width:60,height:60,
                      background:`${s.color}18`,borderRadius:"50%",filter:"blur(15px)"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{width:32,height:32,borderRadius:9,background:`${s.color}18`,
                        border:`1px solid ${s.color}25`,display:"flex",alignItems:"center",
                        justifyContent:"center",fontSize:14}}>{s.icon}</div>
                      <span style={{fontSize:9,color:s.color,fontWeight:700,background:`${s.color}15`,
                        padding:"2px 7px",borderRadius:20,letterSpacing:0.3}}>{s.sub}</span>
                    </div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:0.5,marginBottom:3,fontWeight:600}}>{s.label.toUpperCase()}</div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:s.color,lineHeight:1}}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Store link card */}
              <div className="fade-up fa5" style={{background:"rgba(0,255,198,0.04)",
                border:"1px solid rgba(0,255,198,0.15)",borderRadius:14,padding:"14px 16px",marginBottom:12,
                position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",right:-30,top:-30,width:100,height:100,
                  background:"radial-gradient(circle,rgba(0,255,198,0.08),transparent 70%)"}}/>
                <div style={{fontSize:9,color:"#0ff4c6",fontWeight:700,letterSpacing:1,marginBottom:8}}>🔗 YOUR STORE LINK</div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,
                    padding:"9px 12px",fontSize:10,color:"rgba(255,255,255,0.5)",fontFamily:"monospace",wordBreak:"break-all",minWidth:0}}>
                    {storeUrl}
                  </div>
                  <button style={{padding:"9px 14px",borderRadius:9,border:"1px solid rgba(0,255,198,0.3)",
                    background:"rgba(0,255,198,0.1)",color:"#0ff4c6",cursor:"pointer",
                    fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif",
                    whiteSpace:"nowrap",transition:"all .2s"}}
                    onClick={copyLink}>{copied?"✓ Copied!":"Copy Link"}</button>
                </div>
              </div>

              {/* Quick action chips */}
              <div className="fade-up fa5" style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
                {[
                  {id:"orders",icon:"📦",label:"Orders",color:"#0ff4c6"},
                  {id:"notifications",icon:"📬",label:`Inbox${unreadNotifCount>0?` (${unreadNotifCount})`:""}`,color:"#7b61ff"},
                  {id:"requests",icon:"💡",label:"Suggest",color:"#00d68f"},
                  {id:"withdraw",icon:"💸",label:"Withdraw",color:"#ffd166"},
                ].map(a=>(
                  <button key={a.id} onClick={()=>setTab(a.id)}
                    style={{flex:1,minWidth:70,background:`${a.color}09`,
                      border:`1px solid ${a.color}25`,borderRadius:12,
                      padding:"9px 8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                      fontWeight:600,fontSize:11,color:a.color,
                      display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${a.color}18`;e.currentTarget.style.transform="translateY(-1px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=`${a.color}09`;e.currentTarget.style.transform="translateY(0)";}}>
                    <span style={{fontSize:16}}>{a.icon}</span>
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>

              {/* Recent transactions */}
              <div className="fade-up fa6">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:"rgba(255,255,255,0.7)"}}>RECENT TRANSACTIONS</div>
                  <button onClick={()=>setTab("transactions")}
                    style={{fontSize:10,color:"#0ff4c6",background:"none",border:"none",cursor:"pointer",
                      fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>View all →</button>
                </div>
                {txns.length===0?(
                  <div style={{textAlign:"center",padding:"32px 16px",color:"rgba(255,255,255,0.2)",
                    background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.05)"}}>
                    <div style={{fontSize:32,marginBottom:8,opacity:0.5}}>📭</div>
                    <div style={{fontSize:12}}>No transactions yet. Start selling data!</div>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {txns.slice(0,5).map((t,i)=>{
                      const st = t.admin_status||"Completed";
                      const stColor = STATUS_COLORS[st]||G.green;
                      return(
                      <div key={i} style={{background:"rgba(255,255,255,0.02)",
                        border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,
                        padding:"11px 14px",display:"flex",alignItems:"center",
                        justifyContent:"space-between",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                          <div style={{width:34,height:34,borderRadius:9,
                            background:`${stColor}14`,border:`1px solid ${stColor}25`,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                            {st==="Completed"?"✅":st==="Failed"?"❌":st==="Refunded"?"↩️":st==="Processing"?"⚙️":"🕐"}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:12,color:"rgba(255,255,255,0.85)",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {t.network} · {(t.bundle||"").split(" -")[0]}
                            </div>
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{t.customer_phone}</div>
                          </div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontWeight:700,fontSize:13,color:"#0ff4c6"}}>{fmt(t.amount)}</div>
                          <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,
                            background:`${stColor}15`,color:stColor}}>{st}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* BUY DATA */}
          {tab==="buy"&&(
            <div style={{maxWidth:460}}>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:18}}>Buy Data Bundle</div>
              <div className="fade-up fa2" style={{background:G.card,border:`1px solid ${G.border}`,
                borderRadius:14,padding:"18px 18px",display:"flex",flexDirection:"column",gap:16}}>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:8}}>Network</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {Object.keys(bundles).map(n=>(
                      <button key={n} onClick={()=>setBuyForm(p=>({...p,network:n,bundle:""}))}
                        style={{padding:"9px 18px",borderRadius:10,
                          border:`1px solid ${buyForm.network===n?G.accent:G.border}`,
                          background:buyForm.network===n?`${G.accent}22`:G.surface,
                          color:buyForm.network===n?G.accent:G.muted,
                          cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:14,transition:"all .2s"}}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:8}}>Data Bundle</label>
                  <select style={{...inputStyle,appearance:"none"}} value={buyForm.bundle}
                    onChange={e=>setBuyForm(p=>({...p,bundle:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}>
                    <option value="">Select a bundle…</option>
                    {bundles[buyForm.network].map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:8}}>Customer Phone Number</label>
                  <input style={inputStyle} type="tel" placeholder="e.g. 0244123456"
                    value={buyForm.customer_phone} onChange={e=>setBuyForm(p=>({...p,customer_phone:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                </div>
                <div style={{background:G.surface,borderRadius:12,padding:"14px 18px",
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:G.muted,fontSize:14}}>Wallet Balance</span>
                  <span style={{fontWeight:700,color:G.green,fontSize:18}}>{fmt(reseller.wallet_balance)}</span>
                </div>
                <button style={{...btnStyle("primary"),width:"100%",padding:15,fontSize:16}}
                  onClick={handleBuy} disabled={buying}>
                  {buying?<><span className="spinner"/> Processing…</>:"Send Data Bundle"}
                </button>
                <button style={{...btnStyle("green"),width:"100%",padding:13,fontSize:15}}
                  onClick={fundWallet}>+ Fund Wallet (Demo +GHS50)</button>
              </div>
            </div>
          )}

          {/* SOCIAL MEDIA */}
          {tab==="social"&&<DashSocialTab reseller={reseller} showToast={showToast} fetchData={fetchData}/>}


          {/* MY ORDERS */}
          {tab==="orders"&&(
            <div>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:4}}>My Orders</div>
              <div style={{color:G.muted,fontSize:12,marginBottom:16}}>All orders placed through your store link — live status updates.</div>

              {/* Filter bar */}
              {(()=>{
                const [oFilter, setOFilter] = React.useState("All");
                const storeOrders = txns.filter(t=>t.type==="data_purchase"||t.type==="social_order");
                const filtered = oFilter==="All" ? storeOrders : storeOrders.filter(t=>(t.admin_status||"Completed")===oFilter);
                return(
                <div>
                  <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
                    {["All","Pending","Processing","Completed","Failed","Refunded"].map(f=>{
                      const count = f==="All" ? storeOrders.length : storeOrders.filter(t=>(t.admin_status||"Completed")===f).length;
                      const col = f==="All"?G.accent:STATUS_COLORS[f]||G.muted;
                      return(
                        <button key={f} onClick={()=>setOFilter(f)}
                          style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                            fontWeight:600,fontSize:11,transition:"all .2s",
                            border:`1px solid ${oFilter===f?col:G.border}`,
                            background:oFilter===f?`${col}22`:"transparent",
                            color:oFilter===f?col:G.muted}}>
                          {f} {count>0&&<span style={{opacity:0.7}}>({count})</span>}
                        </button>
                      );
                    })}
                  </div>

                  {filtered.length===0?(
                    <div style={{textAlign:"center",padding:"52px 20px",color:G.muted,
                      background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                      <div style={{fontSize:40,marginBottom:12}}>📦</div>
                      <div style={{fontSize:14,fontWeight:600}}>No orders yet</div>
                      <div style={{fontSize:12,marginTop:6}}>Orders placed via your store link will appear here</div>
                    </div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {filtered.map((t,i)=>{
                        const st = t.admin_status||"Completed";
                        const stColor = STATUS_COLORS[st]||G.green;
                        const isData = t.type==="data_purchase";
                        return(
                          <div key={t.id||i} style={{background:G.card,border:`1px solid ${G.border}`,
                            borderRadius:12,padding:"14px 16px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                                  <span style={{fontSize:14,fontWeight:700,color:isData?G.accent:"#E1306C"}}>
                                    {isData?"📡":"📱"} {isData?t.network:"Social"}
                                  </span>
                                  <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,
                                    background:`${stColor}22`,color:stColor}}>
                                    {st==="Completed"?"✅":st==="Failed"?"❌":st==="Refunded"?"↩️":st==="Processing"?"⚙️":"🕐"} {st}
                                  </span>
                                </div>
                                <div style={{fontSize:12,color:G.text,fontWeight:500,marginBottom:3,
                                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                  {(t.bundle||"").split(" - GHS")[0]}
                                </div>
                                <div style={{fontSize:11,color:G.muted}}>{isData?"📞":"🎯"} {t.customer_phone}</div>
                                {t.order_ref&&(
                                  <div style={{fontSize:10,color:G.accent,marginTop:3,fontFamily:"monospace"}}>{t.order_ref}</div>
                                )}
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{fontWeight:800,fontSize:15,color:G.green,marginBottom:3}}>{fmt(t.amount)}</div>
                                <div style={{fontSize:10,color:G.muted}}>{t.created_at?new Date(t.created_at).toLocaleString("en-GH",{dateStyle:"short",timeStyle:"short"}):""}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {tab==="notifications"&&(
            <ResellerNotificationsTab reseller={reseller} showToast={showToast}/>
          )}

          {/* REQUESTS & SUGGESTIONS */}
          {tab==="requests"&&<ResellerRequestsTab reseller={reseller} showToast={showToast}/>}

          {/* TRANSACTIONS */}
          {tab==="transactions"&&(
            <div>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:16}}>All Transactions</div>
              {txns.length===0?(
                <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
                  background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                  <div style={{fontSize:48,marginBottom:12}}>📭</div>
                  <div style={{fontSize:16}}>No transactions yet</div>
                  <div style={{fontSize:13,marginTop:8}}>Your sales will appear here</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {txns.map((t,i)=>{
                    const st = t.admin_status||"Completed";
                    const stColor = STATUS_COLORS[st]||G.green;
                    return(
                    <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,
                      padding:"16px 20px",display:"flex",alignItems:"center",
                      justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",gap:14,alignItems:"center"}}>
                        <div style={{width:42,height:42,
                          background:`${stColor}22`,
                          borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                          {st==="Completed"?"✅":st==="Failed"?"❌":st==="Refunded"?"↩️":st==="Processing"?"⚙️":"🕐"}
                        </div>
                        <div>
                          <div style={{fontWeight:600}}>{t.network} — {(t.bundle||"").split(" -")[0]}</div>
                          <div style={{fontSize:13,color:G.muted}}>{t.customer_phone}</div>
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:700,fontSize:17,color:G.green}}>{fmt(t.amount)}</div>
                        <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,
                          background:`${stColor}22`,color:stColor,display:"inline-block",marginTop:4}}>{st}</span>
                        <div style={{fontSize:12,color:G.muted,marginTop:3}}>{new Date(t.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* EARNINGS */}
          {tab==="earnings"&&(
            <div>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:6}}>My Earnings & Profit</div>
              <div style={{color:G.muted,fontSize:12,marginBottom:16}}>
                Your profit = what customers pay minus the base cost price.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
                <StatCard icon="💹" label="Total Profit Earned" value={fmt(totalProfit)} sub="From completed sales" color={G.green} delay="fa1"/>
                <StatCard icon="💰" label="Wallet Balance" value={fmt(reseller.wallet_balance)} sub="Available to withdraw" color={G.accent} delay="fa2"/>
                <StatCard icon="📈" label="Total Sales" value={fmt(reseller.total_sales)} sub="All time revenue" color={G.accent2} delay="fa3"/>
                <StatCard icon="🛒" label="Orders" value={String(txns.filter(t=>t.type==="data_purchase").length)} sub="Data purchases" color={G.gold} delay="fa4"/>
              </div>

              {/* Per-bundle profit breakdown */}
              <div className="syne fade-up fa2" style={{fontWeight:700,fontSize:15,marginBottom:10}}>Profit Per Bundle</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,marginBottom:20}}>
                {BASE_BUNDLES.MTN.map(b=>{
                  const sp = getSellingPrice(b);
                  const profit = sp - b.base;
                  return(
                    <div key={b.id} style={{background:G.card,border:`1px solid ${profit>0?G.green+"60":G.border}`,
                      borderRadius:10,padding:"11px 13px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontWeight:700,fontSize:13}}>MTN {b.label}</span>
                        <span style={{fontSize:11,color:G.muted}}>Cost: {fmt(b.base)}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,color:G.muted}}>Price: {fmt(sp)}</span>
                        <span style={{fontWeight:800,fontSize:13,color:profit>0?G.green:G.muted,
                          background:profit>0?`${G.green}18`:`${G.muted}15`,padding:"2px 8px",borderRadius:20}}>
                          +{fmt(profit)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent profitable transactions */}
              <div className="syne fade-up fa3" style={{fontWeight:700,fontSize:15,marginBottom:10}}>Recent Profit Breakdown</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {txns.filter(t=>t.type==="data_purchase").slice(0,10).map((t,i)=>{
                  const netB = BASE_BUNDLES[t.network]||[];
                  const matched = netB.find(b=>(t.bundle||"").startsWith(b.label+" "));
                  const cost = matched?matched.base:(t.amount||0);
                  const profit = (t.amount||0)-cost;
                  const st = t.admin_status||"Completed";
                  return(
                    <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,
                      padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                      <div>
                        <div style={{fontWeight:600}}>{t.network} — {(t.bundle||"").split(" -")[0]}</div>
                        <div style={{fontSize:12,color:G.muted}}>{t.customer_phone} · {new Date(t.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:12,color:G.muted}}>Sold: {fmt(t.amount)}</div>
                        {st==="Completed"?(
                          <div style={{fontWeight:800,fontSize:16,color:profit>0?G.green:G.muted}}>
                            Profit: {fmt(profit>0?profit:0)}
                          </div>
                        ):(
                          <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,
                            background:`${STATUS_COLORS[st]||G.muted}22`,color:STATUS_COLORS[st]||G.muted}}>{st}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {txns.filter(t=>t.type==="data_purchase").length===0&&(
                  <div style={{textAlign:"center",padding:"48px 20px",color:G.muted,
                    background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                    <div style={{fontSize:40,marginBottom:12}}>💹</div>
                    <div>No sales yet. Start selling to see your profit here!</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* WITHDRAW */}
          {tab==="withdraw"&&(()=>{
            const alreadyWithdrawn = withdrawals.filter(w=>w.status!=="Rejected").reduce((s,w)=>s+(w.amount||0),0);
            const availableEarnings = Math.max(0, totalProfit - alreadyWithdrawn);
            return(
            <div style={{maxWidth:500}}>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:6}}>Withdraw Earnings</div>
              <div style={{color:G.muted,fontSize:12,marginBottom:16}}>
                Withdrawals are paid from your order earnings (profit). Admin processes within 24 hours.
              </div>

              {/* Earnings cards */}
              <div className="fade-up fa2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                <div style={{background:`linear-gradient(135deg,${G.green}22,${G.green}10)`,
                  border:`1px solid ${G.green}40`,borderRadius:14,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:G.green,fontWeight:700,marginBottom:4,letterSpacing:0.5}}>TOTAL EARNINGS</div>
                  <div className="syne" style={{fontWeight:800,fontSize:22,color:G.green}}>{fmt(totalProfit)}</div>
                  <div style={{fontSize:11,color:G.muted,marginTop:2}}>From completed orders</div>
                </div>
                <div style={{background:`linear-gradient(135deg,${G.accent}18,${G.accent}08)`,
                  border:`1px solid ${G.accent}40`,borderRadius:14,padding:"14px 16px"}}>
                  <div style={{fontSize:11,color:G.accent,fontWeight:700,marginBottom:4,letterSpacing:0.5}}>AVAILABLE</div>
                  <div className="syne" style={{fontWeight:800,fontSize:22,color:G.accent}}>{fmt(availableEarnings)}</div>
                  <div style={{fontSize:11,color:G.muted,marginTop:2}}>After pending withdrawals</div>
                </div>
              </div>

              {/* Withdrawal form */}
              <div className="fade-up fa3" style={{background:G.card,border:`1px solid ${G.border}`,
                borderRadius:14,padding:"16px 16px",display:"flex",flexDirection:"column",gap:14,marginBottom:18}}>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
                    Amount to Withdraw (GHS)
                  </label>
                  <input style={inputStyle} type="number" min="1" step="0.01"
                    placeholder="e.g. 50.00"
                    value={wdForm.amount} onChange={e=>setWdForm(p=>({...p,amount:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
                    MoMo Number
                  </label>
                  <input style={inputStyle} type="tel" placeholder="e.g. 0244123456"
                    value={wdForm.momo_number} onChange={e=>setWdForm(p=>({...p,momo_number:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
                    Account Name
                  </label>
                  <input style={inputStyle} type="text" placeholder="Name on MoMo account"
                    value={wdForm.momo_name} onChange={e=>setWdForm(p=>({...p,momo_name:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                </div>
                <div>
                  <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
                    Note (optional)
                  </label>
                  <input style={inputStyle} type="text" placeholder="e.g. Profit withdrawal"
                    value={wdForm.note} onChange={e=>setWdForm(p=>({...p,note:e.target.value}))}
                    onFocus={e=>e.target.style.borderColor=G.accent}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                </div>
                <button style={{...btnStyle("green"),width:"100%",padding:12,fontSize:14}}
                  onClick={handleWithdraw} disabled={wdLoading}>
                  {wdLoading?<><span className="spinner"/> Submitting…</>:"💸 Submit Withdrawal Request"}
                </button>
              </div>

              {/* Past withdrawal requests */}
              <div className="syne fade-up fa4" style={{fontWeight:700,fontSize:15,marginBottom:10}}>Withdrawal History</div>
              {withdrawals.length===0?(
                <div style={{textAlign:"center",padding:"40px 20px",color:G.muted,
                  background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                  <div style={{fontSize:36,marginBottom:10}}>💸</div>
                  <div>No withdrawal requests yet.</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {withdrawals.map((w,i)=>{
                    const stColor = {Pending:G.gold,Processing:G.accent,Paid:G.green,Rejected:G.red}[w.status]||G.muted;
                    return(
                      <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,
                        padding:"14px 18px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                          <div>
                            <div style={{fontWeight:700,fontSize:16,color:G.green}}>{fmt(w.amount)}</div>
                            <div style={{fontSize:13,color:G.muted}}>MoMo: {w.momo_number} · {w.momo_name}</div>
                            <div style={{fontSize:12,color:G.muted,marginTop:2}}>{new Date(w.created_at).toLocaleString()}</div>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20,
                            background:`${stColor}22`,color:stColor,flexShrink:0}}>{w.status||"Pending"}</span>
                        </div>
                        {w.note&&<div style={{fontSize:12,color:G.muted,marginTop:8,fontStyle:"italic"}}>"{w.note}"</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })()}

          {/* MY PRICES */}
          {tab==="pricing"&&(
            <div>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:22,marginBottom:8}}>My Prices</div>
              <div style={{color:G.muted,fontSize:14,marginBottom:24}}>
                Set the prices your customers see. Leave a field blank to use the default cost price.
              </div>
              {Object.entries(BASE_BUNDLES).map(([network,blist])=>(
                <div key={network} className="fade-up fa2" style={{background:G.card,
                  border:`1px solid ${G.border}`,borderRadius:16,padding:22,marginBottom:16}}>
                  <div className="syne" style={{fontWeight:700,fontSize:16,marginBottom:14,
                    color:network==="MTN"?G.gold:network==="Telecel"?G.accent:G.accent2}}>
                    {network==="MTN"?"📶":network==="Telecel"?"🔵":"🟠"} {network}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                    {blist.map(b=>{
                      const hasCustom = myPrices[b.id] && myPrices[b.id]!=="";
                      const sellingPrice = hasCustom ? parseFloat(myPrices[b.id]) : b.base;
                      const profit = hasCustom ? (sellingPrice - b.base).toFixed(2) : "0.00";
                      return(
                        <div key={b.id} style={{background:G.surface,borderRadius:12,padding:"14px 16px",
                          border:"1px solid " + (hasCustom ? G.accent+"60" : G.border),
                          transition:"border .2s"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
                            <span style={{fontWeight:600,fontSize:14}}>{b.label}</span>
                            <span style={{fontSize:11,color:G.muted}}>Cost: {fmt(b.base)}</span>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <input
                              style={{...inputStyle,padding:"9px 12px",fontSize:14,
                                borderColor: hasCustom ? G.accent : G.border}}
                              type="number" min="0" step="0.01"
                              placeholder={"Default: " + fmt(b.base)}
                              value={myPrices[b.id]||""}
                              onChange={e=>setPrice(b.id,e.target.value)}
                              onFocus={e=>e.target.style.borderColor=G.accent}
                              onBlur={e=>e.target.style.borderColor=hasCustom?G.accent:G.border}/>
                            {hasCustom&&(
                              <button onClick={()=>clearPrice(b.id)}
                                style={{background:"none",border:"none",color:G.red,
                                  cursor:"pointer",fontSize:18,flexShrink:0}}>✕</button>
                            )}
                          </div>
                          {hasCustom&&(
                            <div style={{fontSize:11,marginTop:8,
                              color:parseFloat(profit)>=0?G.green:G.red}}>
                              {parseFloat(profit)>=0?"Profit":"Loss"}: {parseFloat(profit)>=0?"+":""}{fmt(parseFloat(profit))} per sale
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button style={{...btnStyle("primary"),padding:"14px 32px",fontSize:16,marginTop:8}}
                onClick={savePrices} disabled={savingPrices}>
                {savingPrices?"Saving…":"💾 Save My Prices"}
              </button>
              <div style={{fontSize:13,color:G.muted,marginTop:12}}>
                Prices are saved to this device. Your customers will see these prices in your store.
              </div>
            </div>
          )}

          {/* MY STORE */}
          {tab==="store"&&(
            <div style={{maxWidth:520}}>
              <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:22,marginBottom:24}}>My Store</div>
              <div className="fade-up fa2" style={{background:`linear-gradient(135deg,${G.card},${G.surface})`,
                border:`1px solid ${G.accent}40`,borderRadius:20,padding:32,textAlign:"center"}}>
                <div style={{width:72,height:72,background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
                  borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",
                  fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:32,color:"#fff",margin:"0 auto 16px"}}>
                  {reseller.store_name[0].toUpperCase()}
                </div>
                <div className="syne" style={{fontWeight:800,fontSize:24,marginBottom:4}}>{reseller.store_name}</div>
                <div style={{color:G.muted,fontSize:14,marginBottom:28}}>📞 {reseller.phone_number}</div>
                <div style={{background:G.bg,border:`1px solid ${G.border}`,borderRadius:12,
                  padding:"14px 18px",marginBottom:16,wordBreak:"break-all",
                  fontFamily:"monospace",fontSize:14,color:G.accent}}>{storeUrl}</div>
                <button style={{...btnStyle("primary"),width:"100%",padding:14,fontSize:15}}
                  onClick={copyLink}>{copied?"✓ Link Copied!":"📋 Copy Store Link"}</button>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:24}}>
                  {[["💰","Balance",fmt(reseller.wallet_balance)],
                    ["📈","Sales",fmt(reseller.total_sales)],
                    ["👥","Customers",reseller.total_customers||0]].map(([ico,lbl,val])=>(
                    <div key={lbl} style={{background:G.surface,borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
                      <div style={{fontSize:22,marginBottom:6}}>{ico}</div>
                      <div style={{fontSize:11,color:G.muted}}>{lbl}</div>
                      <div style={{fontWeight:700,fontSize:14,marginTop:4}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile nav — new design */}
      <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:50,
        background:"rgba(7,10,22,0.92)",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",
        borderTop:"1px solid rgba(0,255,198,0.08)",
        boxShadow:"0 -8px 40px rgba(0,0,0,0.7)",
        display:"flex",padding:"6px 4px calc(env(safe-area-inset-bottom,0px) + 6px)",gap:2}}>
        {navItems.map(n=>{
          const active = tab===n.id;
          return(
          <button key={n.id} onClick={()=>setTab(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              gap:1,padding:"6px 2px",border:"none",cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",fontWeight:active?700:400,
              fontSize:active?9:8.5,letterSpacing:0,
              color:active?"#0ff4c6":"rgba(255,255,255,0.25)",
              background:active?"rgba(0,255,198,0.06)":"transparent",
              borderRadius:10,transition:"all .2s",
              position:"relative",overflow:"hidden"}}>
            {active&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
              width:24,height:2,background:"linear-gradient(90deg,#0ff4c6,#7b61ff)",
              borderRadius:"0 0 4px 4px",boxShadow:"0 0 8px rgba(0,255,198,0.6)"}}/>}
            <span style={{fontSize:active?19:16,transition:"all .2s",position:"relative"}}>
              {n.icon}
              {n.id==="notifications"&&unreadNotifCount>0&&(
                <span style={{position:"absolute",top:-4,right:-7,
                  background:"linear-gradient(135deg,#0ff4c6,#7b61ff)",
                  color:"#000",borderRadius:20,fontSize:7,fontWeight:900,
                  padding:"1px 4px",lineHeight:1.2}}>{unreadNotifCount}</span>
              )}
            </span>
            <span style={{lineHeight:1.2}}>{n.label}</span>
          </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Admin Login Modal ── */
function AdminLoginModal({onSuccess, onClose}){
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [err, setErr]     = useState("");
  const ADMIN_PHONE = "0241994988";
  const ADMIN_PASS  = "Admin@DataResell2025";

  const handle = () => {
    if(email.trim()===ADMIN_PHONE && pass===ADMIN_PASS){ onSuccess(); }
    else { setErr("Invalid admin credentials."); }
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",
      zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:20,
        padding:36,width:"100%",maxWidth:420,position:"relative",animation:"fadeUp .3s ease"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22}}>✕</button>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:56,height:56,background:`linear-gradient(135deg,${G.gold},#ff9a3c)`,
            borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:28,margin:"0 auto 14px"}}>🛡️</div>
          <div className="syne" style={{fontWeight:800,fontSize:20,marginBottom:4}}>Admin Access</div>
          <div style={{color:G.muted,fontSize:13}}>DataResell Pro Control Centre</div>
        </div>
        {err&&<div style={{background:`${G.red}22`,border:`1px solid ${G.red}50`,color:G.red,
          padding:"10px 14px",borderRadius:10,fontSize:14,marginBottom:16}}>{err}</div>}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Admin Phone Number</label>
          <input style={inputStyle} type="tel" placeholder="e.g. 0594700561"
            value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handle()}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <div style={{marginBottom:22}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Password</label>
          <input style={inputStyle} type="password" placeholder="Admin password"
            value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handle()}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <button style={{...btnStyle("primary"),width:"100%",padding:15,fontSize:16,
          background:`linear-gradient(135deg,${G.gold},#ff9a3c)`}} onClick={handle}>
          Enter Admin Panel →
        </button>
      </div>
    </div>
  );
}

/* ── Admin Panel ── */
const ORDER_STATUSES = ["Pending","Processing","Completed","Failed","Refunded"];
const STATUS_COLORS  = {
  Pending:"#ffd166", Processing:"#00e5ff", Completed:"#00d68f",
  Failed:"#ff4d6d",  Refunded:"#7b61ff"
};

const BASE_BUNDLES = {
  MTN:[
    {id:"mtn_1gb",  label:"1GB",  base:4.40},
    {id:"mtn_2gb",  label:"2GB",  base:8.70},
    {id:"mtn_3gb",  label:"3GB",  base:12.80},
    {id:"mtn_4gb",  label:"4GB",  base:17.00},
    {id:"mtn_5gb",  label:"5GB",  base:22.00},
    {id:"mtn_10gb", label:"10GB", base:41.00},
    {id:"mtn_25gb", label:"25GB", base:98.00},
    {id:"mtn_50gb", label:"50GB", base:193.00},
  ],
  AirtelTigo:[
    {id:"at_1gb",  label:"1GB",  base:4.40,  outOfStock:true},
    {id:"at_2gb",  label:"2GB",  base:8.70,  outOfStock:true},
    {id:"at_3gb",  label:"3GB",  base:12.80, outOfStock:true},
    {id:"at_5gb",  label:"5GB",  base:22.00, outOfStock:true},
    {id:"at_10gb", label:"10GB", base:41.00, outOfStock:true},
  ],
  Telecel:[
    {id:"tc_1gb",  label:"1GB",  base:4.40,  outOfStock:true},
    {id:"tc_2gb",  label:"2GB",  base:8.70,  outOfStock:true},
    {id:"tc_3gb",  label:"3GB",  base:12.80, outOfStock:true},
    {id:"tc_5gb",  label:"5GB",  base:22.00, outOfStock:true},
    {id:"tc_10gb", label:"10GB", base:41.00, outOfStock:true},
  ],
};

/* ── Reseller Requests & Suggestions Tab ── */
function ResellerRequestsTab({reseller, showToast}){
  const [activeTab, setActiveTab] = useState("submit");
  const [type, setType] = useState("request"); // "request" | "suggestion"
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const fetchMySubmissions = async() => {
    setLoadingSubs(true);
    try{
      const rows = await sb(`reseller_requests?reseller_id=eq.${reseller.id}&order=created_at.desc&select=*`);
      setMySubmissions(rows||[]);
    }catch{ setMySubmissions([]); }
    finally{ setLoadingSubs(false); }
  };

  useEffect(()=>{ if(activeTab==="history") fetchMySubmissions(); },[activeTab]);

  const handleSubmit = async() => {
    if(!title.trim()){ showToast("Please enter a title","error"); return; }
    if(!details.trim()){ showToast("Please add some details","error"); return; }
    setSubmitting(true);
    try{
      await sb("reseller_requests",{
        method:"POST", prefer:"return=representation",
        body:JSON.stringify({
          reseller_id: reseller.id,
          store_name: reseller.store_name,
          phone_number: reseller.phone_number,
          type,
          title: title.trim(),
          details: details.trim(),
          status: "Pending"
        })
      });
      showToast(type==="request"?"✅ Request submitted! We'll review it soon.":"✅ Suggestion noted! Thanks for the feedback.");
      setTitle(""); setDetails(""); setType("request");
    }catch(e){ showToast("Failed to submit: "+e.message,"error"); }
    finally{ setSubmitting(false); }
  };

  const typeColor = type==="request" ? G.accent : G.accent2;

  return(
  <div>
    <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:4}}>Requests & Suggestions</div>
    <div style={{color:G.muted,fontSize:12,marginBottom:16}}>
      Request new products, services, or features — or share ideas to improve the platform.
    </div>

    {/* Sub-tabs */}
    <div style={{display:"flex",background:G.surface,borderRadius:12,padding:4,marginBottom:20,
      border:`1px solid ${G.border}`,maxWidth:360}}>
      {[["submit","✉️ Submit"],["history","📜 My History"]].map(([id,label])=>(
        <button key={id} onClick={()=>setActiveTab(id)}
          style={{flex:1,padding:"9px 8px",border:"none",borderRadius:9,cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,transition:"all .2s",
            background:activeTab===id?`linear-gradient(135deg,${G.accent},${G.accent2})`:"transparent",
            color:activeTab===id?"#fff":G.muted}}>
          {label}
        </button>
      ))}
    </div>

    {activeTab==="submit"&&(
    <div style={{maxWidth:540}}>
      {/* Type selector */}
      <div style={{marginBottom:18}}>
        <div style={{fontSize:13,fontWeight:600,color:G.muted,marginBottom:10}}>What are you submitting?</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            {v:"request",icon:"🛍️",label:"Product Request",desc:"Ask for a new data bundle, network, or service"},
            {v:"suggestion",icon:"💡",label:"Suggestion / Feedback",desc:"Ideas to improve the platform or your experience"},
          ].map(opt=>(
            <div key={opt.v} onClick={()=>setType(opt.v)}
              style={{background:type===opt.v?`${opt.v==="request"?G.accent:G.accent2}18`:G.card,
                border:`1.5px solid ${type===opt.v?(opt.v==="request"?G.accent:G.accent2):G.border}`,
                borderRadius:12,padding:"14px 14px",cursor:"pointer",transition:"all .2s"}}>
              <div style={{fontSize:22,marginBottom:6}}>{opt.icon}</div>
              <div style={{fontWeight:700,fontSize:13,color:G.text,marginBottom:3}}>{opt.label}</div>
              <div style={{fontSize:11,color:G.muted,lineHeight:1.4}}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Title */}
      <div style={{marginBottom:14}}>
        <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
          {type==="request"?"What do you want to request? *":"What's your suggestion? *"}
        </label>
        <input style={{...inputStyle,borderColor:title?typeColor:G.border}}
          type="text"
          placeholder={type==="request"?"e.g. Add Vodafone 5GB bundle":"e.g. Add dark/light mode toggle"}
          value={title} onChange={e=>setTitle(e.target.value)}
          onFocus={e=>e.target.style.borderColor=typeColor}
          onBlur={e=>e.target.style.borderColor=title?typeColor:G.border}/>
      </div>

      {/* Details */}
      <div style={{marginBottom:18}}>
        <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
          Details *
        </label>
        <textarea
          style={{...inputStyle,minHeight:110,resize:"vertical",lineHeight:1.6}}
          placeholder={type==="request"
            ? "Describe the product or service you'd like. Include any pricing expectations, customer demand, or urgency."
            : "Share your full idea or feedback. The more detail, the better we can act on it."}
          value={details} onChange={e=>setDetails(e.target.value)}
          onFocus={e=>e.target.style.borderColor=typeColor}
          onBlur={e=>e.target.style.borderColor=details?typeColor:G.border}/>
        <div style={{fontSize:11,color:G.muted,marginTop:5}}>{details.length}/500 chars</div>
      </div>

      {/* Submit button */}
      <button
        style={{...btnStyle("primary"),width:"100%",padding:14,fontSize:15,
          background:`linear-gradient(135deg,${typeColor},${type==="request"?G.accent2:G.green})`}}
        onClick={handleSubmit} disabled={submitting}>
        {submitting?<><span className="spinner"/> Submitting…</>:
          type==="request"?"🛍️ Submit Request":"💡 Send Suggestion"}
      </button>

      {/* Info note */}
      <div style={{background:`${typeColor}10`,border:`1px solid ${typeColor}25`,
        borderRadius:12,padding:"12px 14px",marginTop:14,display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:16,flexShrink:0}}>ℹ️</span>
        <div style={{fontSize:12,color:G.muted,lineHeight:1.5}}>
          {type==="request"
            ? "We review all product requests regularly. Popular requests are prioritised. You'll see status updates in My History."
            : "Your feedback goes directly to our admin team. We read every suggestion and use them to improve the platform."}
        </div>
      </div>
    </div>
    )}

    {activeTab==="history"&&(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:13,color:G.muted}}>Your past submissions</div>
        <button style={{...btnStyle("ghost"),padding:"6px 12px",fontSize:12}} onClick={fetchMySubmissions}>
          {loadingSubs?<span className="spinner"/>:"↻ Refresh"}
        </button>
      </div>

      {loadingSubs?(
        <div style={{textAlign:"center",padding:"40px",color:G.muted}}>
          <span className="spinner" style={{width:28,height:28,borderTopColor:G.accent}}/> 
        </div>
      ):mySubmissions.length===0?(
        <div style={{textAlign:"center",padding:"52px 20px",color:G.muted,
          background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
          <div style={{fontSize:40,marginBottom:12}}>💬</div>
          <div style={{fontSize:14,fontWeight:600}}>No submissions yet</div>
          <div style={{fontSize:12,marginTop:6}}>Your requests and suggestions will appear here</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {mySubmissions.map((sub,i)=>{
            const isReq = sub.type==="request";
            const stColors = {Pending:G.gold,Under_Review:G.accent,Approved:G.green,Rejected:G.red,Implemented:G.accent2};
            const stColor = stColors[sub.status]||G.muted;
            return(
              <div key={sub.id||i} style={{background:G.card,border:`1px solid ${G.border}`,
                borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                    <span style={{fontSize:16,flexShrink:0}}>{isReq?"🛍️":"💡"}</span>
                    <span style={{fontWeight:600,fontSize:13,color:G.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {sub.title}
                    </span>
                  </div>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,
                    background:`${stColor}22`,color:stColor,flexShrink:0,whiteSpace:"nowrap"}}>
                    {sub.status||"Pending"}
                  </span>
                </div>
                <div style={{fontSize:12,color:G.muted,lineHeight:1.5,marginBottom:6}}>
                  {sub.details}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:G.muted}}>
                  <span style={{background:`${isReq?G.accent:G.accent2}15`,color:isReq?G.accent:G.accent2,
                    padding:"2px 8px",borderRadius:20,fontWeight:600}}>
                    {isReq?"Request":"Suggestion"}
                  </span>
                  <span>{sub.created_at?new Date(sub.created_at).toLocaleDateString("en-GH"):""}</span>
                </div>
                {sub.admin_note&&(
                  <div style={{marginTop:8,background:`${G.gold}12`,border:`1px solid ${G.gold}30`,
                    borderRadius:8,padding:"8px 10px",fontSize:12,color:G.gold}}>
                    <strong>Admin note:</strong> {sub.admin_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    )}
  </div>
  );
}

/* ── Dashboard Social Tab Component ── */
function DashSocialTab({reseller, showToast, fetchData}){
  const [socialForm, setSocialForm] = useState({serviceId:"", qty:1000, link:"", username:"", note:""});
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialCat, setSocialCat] = useState("Instagram");

  const selectedSvc = SOCIAL_SERVICES.find(s=>s.id===socialForm.serviceId);
  const basePrice = selectedSvc ? getSocialBasePrice(selectedSvc) : 0;
  const unitPrice = basePrice / (selectedSvc ? selectedSvc.per : 1000);
  const totalCost = parseFloat((unitPrice * socialForm.qty).toFixed(2));

  const handleSocialOrder = async()=>{
    if(!socialForm.serviceId){showToast("Select a service","error");return;}
    if(!socialForm.link.trim()&&!socialForm.username.trim()){showToast("Enter link or username","error");return;}
    if(socialForm.qty < 100){showToast("Minimum quantity is 100","error");return;}
    if((reseller.wallet_balance||0)<totalCost){showToast("Insufficient wallet balance","error");return;}
    setSocialLoading(true);
    try{
      await sb(`resellers?id=eq.${reseller.id}`,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({wallet_balance:(reseller.wallet_balance||0)-totalCost,total_sales:(reseller.total_sales||0)+totalCost,total_customers:(reseller.total_customers||0)+1})});
      await sb("transactions",{method:"POST",prefer:"return=representation",
        body:JSON.stringify({reseller_id:reseller.id,network:"Social",
          bundle:`${selectedSvc.platform} — ${selectedSvc.name} x${socialForm.qty} | ${socialForm.link||socialForm.username}`,
          amount:totalCost,customer_phone:socialForm.link||socialForm.username,status:"success",type:"social_order"})});
      showToast(`✅ ${selectedSvc.name} order placed!`);
      setSocialForm({serviceId:"",qty:1000,link:"",username:"",note:""});
      fetchData();
    }catch(e){showToast(e.message||"Order failed","error");}
    finally{setSocialLoading(false);}
  };

  const cats = [...new Set(SOCIAL_SERVICES.map(s=>s.category))];
  const filteredSvcs = SOCIAL_SERVICES.filter(s=>s.category===socialCat);

  return(
  <div>
    <div className="syne fade-up fa1" style={{fontWeight:700,fontSize:18,marginBottom:6}}>Social Media Services</div>
    <div style={{color:G.muted,fontSize:12,marginBottom:18}}>Order Instagram, TikTok & more — delivered to your customers.</div>

    {/* Category pills */}
    <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
      {cats.map(c=>(
        <button key={c} onClick={()=>{setSocialCat(c);setSocialForm(p=>({...p,serviceId:""}));}}
          style={{padding:"7px 16px",borderRadius:20,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,transition:"all .2s",
            border:`1px solid ${socialCat===c?"#E1306C":G.border}`,
            background:socialCat===c?"rgba(225,48,108,0.18)":"transparent",
            color:socialCat===c?"#E1306C":G.muted}}>
          {c==="Instagram"?"📸 Instagram":"🎵 General / TikTok"}
        </button>
      ))}
    </div>

    {/* Service cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:8,marginBottom:22}}>
      {filteredSvcs.map(s=>{
        const price = getSocialBasePrice(s);
        const sel = socialForm.serviceId===s.id;
        return(
          <div key={s.id} onClick={()=>setSocialForm(p=>({...p,serviceId:s.id}))}
            style={{background:sel?`${s.color}18`:G.card,border:`1.5px solid ${sel?s.color:G.border}`,
              borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all .2s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <span style={{fontSize:22}}>{s.icon}</span>
              <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,
                background:`${s.color}22`,color:s.color}}>/{s.per}</span>
            </div>
            <div style={{fontWeight:600,fontSize:12,color:G.text,marginBottom:3,lineHeight:1.3}}>{s.name}</div>
            <div style={{fontSize:11,color:G.muted,marginBottom:4}}>{s.platform}</div>
            <div className="syne" style={{fontWeight:800,fontSize:14,color:sel?s.color:G.green}}>
              {fmt(price)} <span style={{fontSize:10,fontWeight:400,color:G.muted}}>/ {s.per}</span>
            </div>
          </div>
        );
      })}
    </div>

    {/* Order form */}
    {socialForm.serviceId && selectedSvc && (
      <div className="fade-up fa2" style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,padding:"18px 18px",display:"flex",flexDirection:"column",gap:14,maxWidth:480}}>
        <div className="syne" style={{fontWeight:700,fontSize:15,color:G.accent}}>
          {selectedSvc.icon} {selectedSvc.name}
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
            {selectedSvc.category==="Instagram"?"Instagram Post/Profile Link *":"Link / Username *"}
          </label>
          <input style={inputStyle} type="text"
            placeholder={selectedSvc.category==="Instagram"?"https://instagram.com/p/... or @username":"URL or @username"}
            value={socialForm.link} onChange={e=>setSocialForm(p=>({...p,link:e.target.value}))}
            onFocus={e=>e.target.style.borderColor=G.accent}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
            {selectedSvc.category==="Instagram"?"Instagram Username (optional)":"Username (optional)"}
          </label>
          <input style={inputStyle} type="text" placeholder="@username"
            value={socialForm.username} onChange={e=>setSocialForm(p=>({...p,username:e.target.value}))}
            onFocus={e=>e.target.style.borderColor=G.accent}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
            Quantity ({selectedSvc.unit}) — min 100
          </label>
          <input style={inputStyle} type="number" min="100" step="100"
            value={socialForm.qty} onChange={e=>setSocialForm(p=>({...p,qty:parseInt(e.target.value)||100}))}
            onFocus={e=>e.target.style.borderColor=G.accent}
            onBlur={e=>e.target.style.borderColor=G.border}/>
          <div style={{fontSize:11,color:G.muted,marginTop:4}}>
            {fmt(unitPrice)} per {selectedSvc.unit.toLowerCase().replace(/s$/,"").replace("follower","follower")}
          </div>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Note (optional)</label>
          <input style={inputStyle} type="text" placeholder="Any special instructions"
            value={socialForm.note} onChange={e=>setSocialForm(p=>({...p,note:e.target.value}))}
            onFocus={e=>e.target.style.borderColor=G.accent}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <div style={{background:G.surface,borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:G.muted,fontSize:14}}>Total Cost</span>
          <span className="syne" style={{fontWeight:800,fontSize:20,color:G.gold}}>{fmt(totalCost)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:G.muted}}>
          <span>Wallet: {fmt(reseller.wallet_balance)}</span>
          <span style={{color:(reseller.wallet_balance||0)>=totalCost?G.green:G.red,fontWeight:600}}>
            {(reseller.wallet_balance||0)>=totalCost?"✓ Sufficient":"✗ Insufficient"}
          </span>
        </div>
        <button style={{...btnStyle("primary"),width:"100%",padding:14,fontSize:15}}
          onClick={handleSocialOrder} disabled={socialLoading}>
          {socialLoading?<><span className="spinner"/> Placing Order…</>:"📱 Place Social Order"}
        </button>
      </div>
    )}
  </div>
  );
}

/* ── Social Media Services ── */
const SOCIAL_SERVICES = [
  // Instagram GHS-priced (prices per 1,000 units)
  {id:"ig_post_share",    category:"Instagram", platform:"Instagram", name:"Post Share",                        priceGHS:2.4717,  per:1000, unit:"Shares",    icon:"📤", color:"#E1306C"},
  {id:"ig_post_saves",    category:"Instagram", platform:"Instagram", name:"Post Saves [Instant]",              priceGHS:3.1073,  per:1000, unit:"Saves",     icon:"🔖", color:"#E1306C"},
  {id:"ig_likes_cheap",   category:"Instagram", platform:"Instagram", name:"Likes | Cheapest",                  priceGHS:5.1414,  per:1000, unit:"Likes",     icon:"❤️", color:"#E1306C"},
  {id:"ig_likes_mid",     category:"Instagram", platform:"Instagram", name:"Likes | Cheap",                     priceGHS:8.4744,  per:1000, unit:"Likes",     icon:"❤️", color:"#E1306C"},
  {id:"ig_likes_nd",      category:"Instagram", platform:"Instagram", name:"Likes | Non Drop",                  priceGHS:12.1378, per:1000, unit:"Likes",     icon:"❤️", color:"#E1306C"},
  {id:"ig_followers_1",   category:"Instagram", platform:"Instagram", name:"Followers [Cheapest] ~ REFILL 365D",priceGHS:17.655,  per:1000, unit:"Followers", icon:"👥", color:"#E1306C"},
  {id:"ig_followers_2",   category:"Instagram", platform:"Instagram", name:"Followers [Cheapest] ~ 1k/day ~ REFILL 30D", priceGHS:28.6894, per:1000, unit:"Followers", icon:"👥", color:"#E1306C"},
  {id:"ig_followers_3",   category:"Instagram", platform:"Instagram", name:"Followers [Working] [Flag OFF] ~ REFILL 365D", priceGHS:29.425, per:1000, unit:"Followers", icon:"👥", color:"#E1306C"},
  {id:"ig_followers_4",   category:"Instagram", platform:"Instagram", name:"Followers [Cheapest] ~ 10k/day ~ REFILL 30D", priceGHS:43.0341, per:1000, unit:"Followers", icon:"👥", color:"#E1306C"},
  // General/TikTok GHS-priced
  {id:"gen_live_views",   category:"General",   platform:"TikTok/General", name:"Live Views",        priceGHS:2,  per:1000, unit:"Views",    icon:"👁️", color:"#00e5ff"},
  {id:"gen_battle_pts",   category:"General",   platform:"TikTok/General", name:"Battle Points",     priceGHS:2,  per:1000, unit:"Points",   icon:"⚔️", color:"#00e5ff"},
  {id:"gen_comment_lk",   category:"General",   platform:"TikTok/General", name:"Comment Likes",     priceGHS:2,  per:100,  unit:"Likes",    icon:"💬", color:"#00e5ff"},
  {id:"gen_add_fav",      category:"General",   platform:"TikTok/General", name:"Add Favorites",     priceGHS:3,  per:1000, unit:"Favs",     icon:"⭐", color:"#00e5ff"},
  {id:"gen_views_cheap",  category:"General",   platform:"TikTok/General", name:"Views (Cheap)",     priceGHS:5,  per:1000, unit:"Views",    icon:"👁️", color:"#7b61ff"},
  {id:"gen_live_likes",   category:"General",   platform:"TikTok/General", name:"Live Likes",        priceGHS:5,  per:1000, unit:"Likes",    icon:"❤️", color:"#7b61ff"},
  {id:"gen_views_best",   category:"General",   platform:"TikTok/General", name:"Views (Best Speed)",priceGHS:7,  per:1000, unit:"Views",    icon:"🚀", color:"#7b61ff"},
  {id:"gen_likes_cheap",  category:"General",   platform:"TikTok/General", name:"Likes (Cheap)",     priceGHS:7,  per:1000, unit:"Likes",    icon:"❤️", color:"#7b61ff"},
  {id:"gen_likes_best",   category:"General",   platform:"TikTok/General", name:"Likes (Best Speed)",priceGHS:8,  per:1000, unit:"Likes",    icon:"❤️", color:"#7b61ff"},
  {id:"gen_shares",       category:"General",   platform:"TikTok/General", name:"Shares",            priceGHS:8,  per:1000, unit:"Shares",   icon:"↗️", color:"#7b61ff"},
  {id:"gen_story_views",  category:"General",   platform:"TikTok/General", name:"Story Views",       priceGHS:18, per:1000, unit:"Views",    icon:"🎞️", color:"#7b61ff"},
  {id:"gen_followers",    category:"General",   platform:"TikTok/General", name:"Followers ⭐",       priceGHS:28, per:100,  unit:"Followers",icon:"👥", color:"#7b61ff"},
];

const USD_TO_GHS = 15.5; // approximate exchange rate
const getSocialBasePrice = (s) => s.priceGHS !== undefined ? s.priceGHS : parseFloat((s.priceUSD * USD_TO_GHS).toFixed(2));

/* ── Manual Order Entry Modal ── */
function ManualOrderModal({resellers, onClose, onSuccess, showToast}){
  const [resellerId, setResellerId] = useState("");
  const [network,    setNetwork]    = useState("MTN");
  const [bundle,     setBundle]     = useState("");
  const [custPhone,  setCustPhone]  = useState("");
  const [amount,     setAmount]     = useState("");
  const [payRef,     setPayRef]     = useState("");
  const [status,     setStatus]     = useState("Completed");
  const [loading,    setLoading]    = useState(false);

  const selectedReseller = resellers.find(r=>r.id===resellerId);

  useEffect(()=>{
    if(selectedReseller){
      const prefix = "_G"+selectedReseller.store_name.replace(/\s+/g,"").toUpperCase().slice(0,12)+"_";
      setPayRef(prefix);
    }
  },[resellerId]);

  const networkBundles = {
    MTN:["1GB","2GB","3GB","4GB","5GB","10GB","25GB","50GB"],
    AirtelTigo:["1GB","2GB","3GB","5GB","10GB"],
    Telecel:["1GB","2GB","3GB","5GB","10GB"],
  };

  const handle = async()=>{
    if(!resellerId){ showToast("Select a reseller","error"); return; }
    if(!custPhone.trim()){ showToast("Enter customer phone","error"); return; }
    if(!bundle.trim()){ showToast("Select a bundle","error"); return; }
    const amt = parseFloat(amount);
    if(isNaN(amt)||amt<=0){ showToast("Enter a valid amount","error"); return; }
    setLoading(true);
    try{
      const bundleStr = bundle+" - GHS"+amt.toFixed(2);
      await sb("transactions",{
        method:"POST", prefer:"return=representation",
        body:JSON.stringify({
          reseller_id:resellerId, network, bundle:bundleStr, amount:amt,
          customer_phone:custPhone.trim(), status:"success", type:"data_purchase",
          admin_status:status, payment_ref:payRef.trim()||undefined
        })
      });
      const r = selectedReseller;
      await sb(`resellers?id=eq.${resellerId}`,{
        method:"PATCH", prefer:"return=representation",
        body:JSON.stringify({
          total_sales:(r.total_sales||0)+amt,
          total_customers:(r.total_customers||0)+1
        })
      });
      showToast("✅ Order added to "+r.store_name);
      onSuccess();
    }catch(e){ showToast("Failed: "+e.message,"error"); }
    finally{ setLoading(false); }
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",
      zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",
      padding:20,overflowY:"auto"}}>
      <div style={{background:G.card,border:`1px solid ${G.gold}40`,borderRadius:20,
        padding:32,width:"100%",maxWidth:480,position:"relative",animation:"fadeUp .3s ease",margin:"auto"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22}}>✕</button>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:48,height:48,background:`${G.gold}22`,borderRadius:14,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>➕</div>
          <div>
            <div className="syne" style={{fontWeight:800,fontSize:18,color:G.gold}}>Manual Order Entry</div>
            <div style={{fontSize:13,color:G.muted}}>Add a Paystack-paid order to a reseller's dashboard</div>
          </div>
        </div>

        {/* Reseller */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Reseller</label>
          <select style={{...inputStyle,appearance:"none"}} value={resellerId}
            onChange={e=>setResellerId(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}>
            <option value="">— Select reseller —</option>
            {resellers.map(r=>(
              <option key={r.id} value={r.id}>{r.store_name} · {r.phone_number}</option>
            ))}
          </select>
        </div>

        {/* Network */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Network</label>
          <div style={{display:"flex",gap:8}}>
            {["MTN","AirtelTigo","Telecel"].map(n=>(
              <button key={n} onClick={()=>{setNetwork(n);setBundle("");}}
                style={{flex:1,padding:"9px 4px",borderRadius:10,cursor:"pointer",
                  border:`1px solid ${network===n?G.gold:G.border}`,
                  background:network===n?`${G.gold}22`:"transparent",
                  color:network===n?G.gold:G.muted,
                  fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,transition:"all .2s"}}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Bundle */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Bundle</label>
          <select style={{...inputStyle,appearance:"none"}} value={bundle}
            onChange={e=>setBundle(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}>
            <option value="">— Select bundle —</option>
            {(networkBundles[network]||[]).map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Customer Phone */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Customer Phone (data recipient)</label>
          <input style={inputStyle} type="tel" placeholder="e.g. 0244123456"
            value={custPhone} onChange={e=>setCustPhone(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>

        {/* Amount */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Amount Paid (GHS)</label>
          <input style={inputStyle} type="number" min="0" step="0.01" placeholder="e.g. 8.60"
            value={amount} onChange={e=>setAmount(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>

        {/* Paystack Reference */}
        <div style={{marginBottom:14}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>
            Paystack Reference <span style={{fontWeight:400,color:G.muted}}>(from your email)</span>
          </label>
          <input style={inputStyle} type="text" placeholder="_GSTORENAME_..."
            value={payRef} onChange={e=>setPayRef(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=G.border}/>
          {selectedReseller&&(
            <div style={{fontSize:11,color:G.gold,marginTop:5}}>
              Expected prefix from Paystack email: <strong>_G{selectedReseller.store_name.replace(/\s+/g,"").toUpperCase().slice(0,12)}_</strong>
            </div>
          )}
        </div>

        {/* Profit Preview */}
        {bundle && amount && !isNaN(parseFloat(amount)) && (()=>{
          const netB = BASE_BUNDLES[network]||[];
          const matched = netB.find(b=>b.label===bundle);
          const cost = matched?matched.base:null;
          const profit = cost !== null ? (parseFloat(amount)-cost).toFixed(2) : null;
          if(cost===null) return null;
          return(
            <div style={{background:parseFloat(profit)>=0?`${G.green}15`:`${G.red}15`,
              border:`1px solid ${parseFloat(profit)>=0?G.green:G.red}40`,
              borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",
              alignItems:"center"}}>
              <span style={{fontSize:13,color:G.muted}}>Base cost: <strong style={{color:G.text}}>{fmt(cost)}</strong></span>
              <span style={{fontSize:14,fontWeight:800,color:parseFloat(profit)>=0?G.green:G.red}}>
                Profit: {parseFloat(profit)>=0?"+":""}{fmt(parseFloat(profit))}
              </span>
            </div>
          );
        })()}

        {/* Status */}
        <div style={{marginBottom:22}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Order Status</label>
          <select style={{...inputStyle,appearance:"none",
            borderColor:STATUS_COLORS[status]||G.border,color:STATUS_COLORS[status]||G.text}}
            value={status} onChange={e=>setStatus(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.gold}
            onBlur={e=>e.target.style.borderColor=STATUS_COLORS[status]||G.border}>
            {ORDER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button style={{...btnStyle("ghost"),flex:1,padding:13}} onClick={onClose}>Cancel</button>
          <button style={{...btnStyle("primary"),flex:2,padding:14,fontSize:15,
            background:`linear-gradient(135deg,${G.gold},#ff9a3c)`}}
            onClick={handle} disabled={loading}>
            {loading?<><span className="spinner"/> Adding…</>:"➕ Add Order to Dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Wallet Top-up Modal ── */
function WalletTopupModal({reseller, onClose, onSuccess, showToast}){
  const [amount, setAmount] = useState("");
  const [note, setNote]     = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async() => {
    const amt = parseFloat(amount);
    if(isNaN(amt)||amt<=0){ showToast("Enter a valid amount","error"); return; }
    setLoading(true);
    try{
      const newBal = (reseller.wallet_balance||0) + amt;
      await sb(`resellers?id=eq.${reseller.id}`,{
        method:"PATCH", prefer:"return=representation",
        body:JSON.stringify({wallet_balance:newBal})
      });
      // Log as a transaction
      await sb("transactions",{
        method:"POST", prefer:"return=representation",
        body:JSON.stringify({
          reseller_id:reseller.id,
          network:"ADMIN",
          bundle:`Wallet Top-up${note?" — "+note:""}`,
          amount:amt,
          customer_phone:reseller.phone_number,
          status:"success",
          type:"wallet_topup",
          admin_status:"Completed"
        })
      });
      showToast(`✅ GHS ${amt.toFixed(2)} added to ${reseller.store_name}`);
      onSuccess();
    }catch(e){ showToast("Top-up failed: "+e.message,"error"); }
    finally{ setLoading(false); }
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",
      zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:20,
        padding:32,width:"100%",maxWidth:400,position:"relative",animation:"fadeUp .3s ease"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22}}>✕</button>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:48,height:48,background:`${G.green}22`,borderRadius:14,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>💳</div>
          <div>
            <div className="syne" style={{fontWeight:800,fontSize:17,color:G.green}}>Fund Wallet</div>
            <div style={{fontSize:13,color:G.muted}}>{reseller.store_name} · Current: {fmt(reseller.wallet_balance)}</div>
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Amount (GHS)</label>
          <input style={inputStyle} type="number" min="1" step="0.01" placeholder="e.g. 100.00"
            value={amount} onChange={e=>setAmount(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.green}
            onBlur={e=>e.target.style.borderColor=G.border}
            onKeyDown={e=>e.key==="Enter"&&handle()}/>
        </div>
        <div style={{marginBottom:22}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:7}}>Note (optional)</label>
          <input style={inputStyle} type="text" placeholder="e.g. Manual deposit"
            value={note} onChange={e=>setNote(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.green}
            onBlur={e=>e.target.style.borderColor=G.border}/>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button style={{...btnStyle("ghost"),flex:1,padding:13}} onClick={onClose}>Cancel</button>
          <button style={{...btnStyle("green"),flex:2,padding:13,fontSize:15}} onClick={handle} disabled={loading}>
            {loading?<><span className="spinner"/> Adding…</>:"💳 Add Funds"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk Status Upload Modal ── */
function BulkStatusModal({orders, onClose, onDone, showToast}){
  const [csvText, setCsvText]   = useState("");
  const [preview, setPreview]   = useState([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied]   = useState(0);

  const SAMPLE = `order_id,status\n<order-id-here>,Completed\n<order-id-here>,Failed\n<order-id-here>,Refunded`;

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").map(l=>l.trim()).filter(Boolean);
    if(!lines.length){ setPreview([]); return; }
    const header = lines[0].toLowerCase().split(",").map(h=>h.trim());
    const idIdx = header.indexOf("order_id");
    const stIdx = header.indexOf("status");
    if(idIdx===-1||stIdx===-1){ setPreview([]); return; }
    const rows = lines.slice(1).map(l=>{
      const cols = l.split(",").map(c=>c.trim());
      return { id: cols[idIdx], status: cols[stIdx] };
    }).filter(r=>r.id && ORDER_STATUSES.includes(r.status));
    setPreview(rows);
  };

  const handleApply = async() => {
    if(!preview.length){ showToast("No valid rows to apply","error"); return; }
    setApplying(true);
    let count = 0;
    for(const row of preview){
      try{
        await sb(`transactions?id=eq.${row.id}`,{
          method:"PATCH", prefer:"return=representation",
          body:JSON.stringify({admin_status:row.status})
        });
        count++;
        setApplied(count);
      }catch{}
    }
    setApplying(false);
    showToast(`✅ Updated ${count} of ${preview.length} orders`);
    onDone();
  };

  const downloadSample = () => {
    // Build sample with real order IDs from current orders
    const rows = orders.slice(0,5).map(o=>`${o.id},Completed`).join("\n");
    const content = `order_id,status\n${rows||"<paste-order-id>,Completed"}`;
    const blob = new Blob([content],{type:"text/csv"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "order_status_template.csv"; a.click();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",
      zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:20,
        padding:32,width:"100%",maxWidth:600,position:"relative",animation:"fadeUp .3s ease",margin:"auto"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22}}>✕</button>

        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
          <div style={{width:48,height:48,background:`${G.accent}22`,borderRadius:14,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📤</div>
          <div>
            <div className="syne" style={{fontWeight:800,fontSize:18,color:G.accent}}>Bulk Order Status Upload</div>
            <div style={{fontSize:13,color:G.muted}}>Paste CSV or type rows to update many orders at once</div>
          </div>
        </div>

        <div style={{background:`${G.accent}10`,border:`1px solid ${G.accent}30`,borderRadius:12,
          padding:"12px 16px",marginBottom:20,marginTop:16}}>
          <div style={{fontSize:12,color:G.accent,fontWeight:700,marginBottom:4}}>📋 FORMAT</div>
          <code style={{fontSize:12,color:G.muted,fontFamily:"monospace",whiteSpace:"pre-wrap",lineHeight:1.7}}>
            {`order_id,status\n<uuid>,Completed\n<uuid>,Failed`}
          </code>
          <div style={{fontSize:11,color:G.muted,marginTop:8}}>
            Valid statuses: {ORDER_STATUSES.join(", ")}
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <button style={{...btnStyle("ghost"),padding:"9px 16px",fontSize:13,flex:1}}
            onClick={downloadSample}>⬇ Download Template</button>
          <button style={{...btnStyle("ghost"),padding:"9px 16px",fontSize:13,flex:1}}
            onClick={()=>{
              // Quick-fill with all current orders set to Completed
              const rows = orders.map(o=>`${o.id},Completed`).join("\n");
              const text = `order_id,status\n${rows}`;
              setCsvText(text); parseCSV(text);
            }}>📋 Load All Orders</button>
        </div>

        <textarea
          style={{...inputStyle, minHeight:160, fontFamily:"monospace",fontSize:13,
            resize:"vertical",lineHeight:1.6}}
          placeholder={SAMPLE}
          value={csvText}
          onChange={e=>{ setCsvText(e.target.value); parseCSV(e.target.value); }}
          onFocus={e=>e.target.style.borderColor=G.accent}
          onBlur={e=>e.target.style.borderColor=G.border}
        />

        {preview.length>0&&(
          <div style={{marginTop:16,marginBottom:4}}>
            <div style={{fontSize:13,color:G.green,fontWeight:700,marginBottom:10}}>
              ✅ {preview.length} valid row{preview.length!==1?"s":""} detected
            </div>
            <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {preview.map((r,i)=>(
                <div key={i} style={{background:G.surface,borderRadius:10,padding:"10px 14px",
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  border:`1px solid ${G.border}`}}>
                  <span style={{fontFamily:"monospace",fontSize:12,color:G.muted,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>
                    {r.id}
                  </span>
                  <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,
                    background:`${STATUS_COLORS[r.status]||G.muted}22`,
                    color:STATUS_COLORS[r.status]||G.muted}}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {applying&&(
          <div style={{marginTop:14,background:`${G.accent}10`,borderRadius:10,
            padding:"12px 16px",fontSize:13,color:G.accent}}>
            ⚙️ Applying… {applied}/{preview.length} updated
          </div>
        )}

        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button style={{...btnStyle("ghost"),flex:1,padding:13}} onClick={onClose}>Cancel</button>
          <button style={{...btnStyle("primary"),flex:2,padding:13,fontSize:15}}
            onClick={handleApply} disabled={applying||preview.length===0}>
            {applying?<><span className="spinner"/> Applying…</>:`📤 Apply ${preview.length} Updates`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Broadcast Modal ── */
function BroadcastModal({resellers, onClose, showToast}){
  const [msg, setMsg]       = useState("");
  const [target, setTarget] = useState("all"); // "all" | "active" | "inactive"
  const [sending, setSending] = useState(false);

  const targets = {
    all: resellers,
    active: resellers.filter(r=>(r.total_sales||0)>0),
    inactive: resellers.filter(r=>(r.total_sales||0)===0),
  };
  const selected = targets[target]||[];

  const handleSend = async() => {
    if(!msg.trim()){ showToast("Enter a message","error"); return; }
    setSending(true);
    try{
      // Post a notification record per reseller (reseller reads from notifications table)
      const rows = selected.map(r=>({
        reseller_id: r.id,
        message: msg.trim(),
        read: false
      }));
      if(rows.length){
        await sb("notifications",{
          method:"POST", prefer:"return=representation",
          body:JSON.stringify(rows)
        });
      }
      showToast(`📢 Message sent to ${selected.length} reseller${selected.length!==1?"s":""}`);
      onClose();
    }catch(e){
      // Table may not exist yet — gracefully inform admin
      showToast(`Note: Notifications table not set up yet (${e.message})`, "error");
    }
    finally{ setSending(false); }
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",
      zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:20,
        padding:32,width:"100%",maxWidth:460,position:"relative",animation:"fadeUp .3s ease"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:16,background:"none",
          border:"none",color:G.muted,cursor:"pointer",fontSize:22}}>✕</button>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
          <div style={{width:48,height:48,background:`${G.accent2}22`,borderRadius:14,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>📢</div>
          <div>
            <div className="syne" style={{fontWeight:800,fontSize:18,color:G.accent2}}>Broadcast Message</div>
            <div style={{fontSize:13,color:G.muted}}>Send a notice to your resellers</div>
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:8}}>Audience</label>
          <div style={{display:"flex",gap:8}}>
            {[["all","All"],["active","Active"],["inactive","No Sales"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTarget(v)}
                style={{flex:1,padding:"9px 4px",borderRadius:10,border:`1px solid ${target===v?G.accent2:G.border}`,
                  background:target===v?`${G.accent2}22`:"transparent",
                  color:target===v?G.accent2:G.muted,cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,transition:"all .2s"}}>
                {l} ({targets[v].length})
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:22}}>
          <label style={{fontSize:13,fontWeight:600,color:G.muted,display:"block",marginBottom:8}}>Message</label>
          <textarea style={{...inputStyle,minHeight:100,resize:"vertical",lineHeight:1.6}}
            placeholder="e.g. System maintenance tonight at 10pm. No downtime expected."
            value={msg} onChange={e=>setMsg(e.target.value)}
            onFocus={e=>e.target.style.borderColor=G.accent2}
            onBlur={e=>e.target.style.borderColor=G.border}/>
          <div style={{fontSize:11,color:G.muted,marginTop:6}}>
            Will be sent to {selected.length} reseller{selected.length!==1?"s":""}
          </div>
        </div>

        <div style={{display:"flex",gap:10}}>
          <button style={{...btnStyle("ghost"),flex:1,padding:13}} onClick={onClose}>Cancel</button>
          <button style={{...btnStyle("primary"),flex:2,padding:13,fontSize:15,
            background:`linear-gradient(135deg,${G.accent2},#5b4dcc)`}}
            onClick={handleSend} disabled={sending||selected.length===0}>
            {sending?<><span className="spinner"/> Sending…</>:`📢 Send to ${selected.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Admin Requests Tab Component (with Reply) ── */
function AdminRequestsTab({resellerRequests, resellers, showToast, onRefresh}){
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [updatingId, setUpdatingId] = useState(null);
  const [replyingId, setReplyingId] = useState(null);
  const [replyDrafts, setReplyDrafts] = useState({});

  const filtered = resellerRequests.filter(r=>{
    const matchStatus = filter==="All"||(r.status||"Pending")===filter;
    const matchType = typeFilter==="All"||r.type===typeFilter;
    return matchStatus && matchType;
  });

  const updateStatus = async(id, status)=>{
    setUpdatingId(id);
    try{
      await sb(`reseller_requests?id=eq.${id}`,{
        method:"PATCH", prefer:"return=representation",
        body:JSON.stringify({status})
      });
      showToast(`Status updated to ${status}`);
      onRefresh();
    }catch(e){ showToast("Update failed: "+e.message,"error"); }
    finally{ setUpdatingId(null); }
  };

  const sendReply = async(id, draft)=>{
    if(!draft||!draft.trim()){ showToast("Write a reply first","error"); return; }
    setUpdatingId(id);
    try{
      await sb(`reseller_requests?id=eq.${id}`,{
        method:"PATCH", prefer:"return=representation",
        body:JSON.stringify({admin_note: draft.trim(), status:"Under_Review"})
      });
      showToast("✅ Reply sent! Reseller can view it in their Inbox.");
      setReplyDrafts(p=>({...p,[id]:""}));
      setReplyingId(null);
      onRefresh();
    }catch(e){ showToast("Reply failed: "+e.message,"error"); }
    finally{ setUpdatingId(null); }
  };

  const stColors = {Pending:G.gold,Under_Review:G.accent,Approved:G.green,Rejected:G.red,Implemented:G.accent2};
  const reqStatuses = ["Pending","Under_Review","Approved","Rejected","Implemented"];

  const counts = {
    All: resellerRequests.length,
    request: resellerRequests.filter(r=>r.type==="request").length,
    suggestion: resellerRequests.filter(r=>r.type==="suggestion").length,
    Pending: resellerRequests.filter(r=>(r.status||"Pending")==="Pending").length,
  };

  return(
  <div>
    <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:22,marginBottom:4}}>Admin Inbox — Requests & Suggestions</div>
    <div style={{color:G.muted,fontSize:13,marginBottom:20}}>
      Reply to reseller submissions. Replies appear in each reseller's Inbox → My Requests tab.
    </div>

    {/* Summary cards */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:22}}>
      {[
        {icon:"📩",label:"Total",value:resellerRequests.length,color:G.accent},
        {icon:"🛍️",label:"Product Requests",value:counts.request,color:G.accent2},
        {icon:"💡",label:"Suggestions",value:counts.suggestion,color:G.green},
        {icon:"🕐",label:"Pending Review",value:counts.Pending,color:G.gold},
      ].map((s,i)=>(
        <div key={i} style={{background:G.card,border:`1px solid ${s.color}30`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
          <div className="syne" style={{fontWeight:800,fontSize:22,color:s.color}}>{s.value}</div>
          <div style={{fontSize:11,color:G.muted,marginTop:2}}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Filters */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["All","request","suggestion"].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)}
            style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              fontWeight:600,fontSize:11,transition:"all .2s",
              border:`1px solid ${typeFilter===t?G.accent:G.border}`,
              background:typeFilter===t?`${G.accent}22`:"transparent",
              color:typeFilter===t?G.accent:G.muted}}>
            {t==="All"?"All Types":t==="request"?"🛍️ Requests":"💡 Suggestions"}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["All",...reqStatuses].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:"5px 12px",borderRadius:20,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              fontWeight:600,fontSize:11,transition:"all .2s",
              border:`1px solid ${filter===s?(stColors[s]||G.accent):G.border}`,
              background:filter===s?`${stColors[s]||G.accent}22`:"transparent",
              color:filter===s?(stColors[s]||G.accent):G.muted}}>
            {s==="All"?"All Statuses":s.replace("_"," ")}
          </button>
        ))}
      </div>
    </div>

    {filtered.length===0?(
      <div style={{textAlign:"center",padding:"60px 20px",color:G.muted,
        background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
        <div style={{fontSize:48,marginBottom:12}}>💬</div>
        <div style={{fontSize:15,fontWeight:600}}>No submissions yet</div>
        <div style={{fontSize:13,marginTop:8}}>Reseller requests and suggestions will appear here</div>
      </div>
    ):(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map((req,i)=>{
          const isReq = req.type==="request";
          const st = req.status||"Pending";
          const stColor = stColors[st]||G.muted;
          const isReplying = replyingId===req.id;
          const draft = replyDrafts[req.id]||"";
          return(
            <div key={req.id||i} style={{background:G.card,border:`1px solid ${req.admin_note?G.gold+"40":G.border}`,
              borderRadius:14,padding:"18px 20px",transition:"all .2s"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:12}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                    <span style={{fontSize:16}}>{isReq?"🛍️":"💡"}</span>
                    <span style={{fontWeight:700,fontSize:15,color:G.text}}>{req.title}</span>
                    <span style={{fontSize:10,background:isReq?`${G.accent}22`:`${G.accent2}22`,
                      color:isReq?G.accent:G.accent2,padding:"2px 8px",borderRadius:20,fontWeight:600}}>
                      {isReq?"Request":"Suggestion"}
                    </span>
                    {req.admin_note&&<span style={{fontSize:9,background:`${G.green}22`,color:G.green,padding:"2px 7px",borderRadius:20,fontWeight:700}}>✓ Replied</span>}
                  </div>
                  <div style={{fontSize:12,color:G.muted,marginBottom:6}}>
                    <strong style={{color:G.text}}>{req.store_name}</strong> · {req.phone_number}
                  </div>
                  <div style={{fontSize:13,color:G.muted,lineHeight:1.6,background:G.surface,borderRadius:8,padding:"10px 12px"}}>
                    {req.details}
                  </div>
                  {req.admin_note&&(
                    <div style={{marginTop:8,fontSize:12,color:G.gold,background:`${G.gold}10`,borderRadius:8,padding:"10px 12px",border:`1px solid ${G.gold}25`,display:"flex",gap:8,alignItems:"flex-start"}}>
                      <span style={{fontSize:16,flexShrink:0}}>🛡️</span>
                      <div><strong>Your reply:</strong> {req.admin_note}</div>
                    </div>
                  )}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,
                    background:`${stColor}22`,color:stColor,display:"inline-block",marginBottom:6}}>
                    {st.replace("_"," ")}
                  </span>
                  <div style={{fontSize:10,color:G.muted}}>
                    {req.created_at?new Date(req.created_at).toLocaleString("en-GH",{dateStyle:"short",timeStyle:"short"}):""}
                  </div>
                </div>
              </div>

              {/* Reply box */}
              {isReplying&&(
                <div style={{background:G.surface,borderRadius:10,padding:"12px 14px",marginBottom:12,border:`1px solid ${G.accent2}40`}}>
                  <div style={{fontSize:11,color:G.accent2,fontWeight:700,marginBottom:8,letterSpacing:0.3}}>💬 SEND REPLY TO RESELLER</div>
                  <textarea value={draft}
                    onChange={e=>setReplyDrafts(p=>({...p,[req.id]:e.target.value}))}
                    style={{...inputStyle,minHeight:80,resize:"vertical",lineHeight:1.6,marginBottom:10,fontSize:13}}
                    placeholder="Write your reply… it will appear in the reseller's Inbox under 'My Requests'"
                    onFocus={e=>e.target.style.borderColor=G.accent2}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setReplyingId(null)}
                      style={{...btnStyle("ghost"),padding:"8px 16px",fontSize:13,flex:1}}>Cancel</button>
                    <button onClick={()=>sendReply(req.id,draft)}
                      disabled={!draft.trim()||updatingId===req.id}
                      style={{...btnStyle("primary"),padding:"8px 16px",fontSize:13,flex:2,
                        background:`linear-gradient(135deg,${G.accent2},${G.accent})`}}>
                      {updatingId===req.id?<><span className="spinner"/>Sending…</>:"📨 Send Reply"}
                    </button>
                  </div>
                </div>
              )}

              {/* Status + reply actions */}
              <div style={{borderTop:`1px solid ${G.border}`,paddingTop:12,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <button onClick={()=>setReplyingId(isReplying?null:req.id)}
                  style={{...btnStyle("ghost"),padding:"5px 12px",fontSize:11,
                    background:isReplying?`${G.accent2}22`:"transparent",
                    color:isReplying?G.accent2:G.muted,
                    border:`1px solid ${isReplying?G.accent2:G.border}`}}>
                  💬 {req.admin_note?"Edit Reply":"Reply"}
                </button>
                <span style={{fontSize:11,color:G.muted,fontWeight:600,marginLeft:4}}>Status:</span>
                {reqStatuses.map(s=>(
                  <button key={s} onClick={()=>updateStatus(req.id,s)}
                    disabled={st===s||updatingId===req.id}
                    style={{padding:"5px 10px",borderRadius:8,cursor:st===s?"default":"pointer",
                      fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:10,transition:"all .2s",
                      border:`1px solid ${st===s?(stColors[s]||G.border):G.border}`,
                      background:st===s?`${stColors[s]||G.muted}30`:"transparent",
                      color:st===s?(stColors[s]||G.muted):G.muted,
                      opacity:updatingId===req.id?0.5:1}}>
                    {updatingId===req.id&&s===st?<span className="spinner" style={{width:10,height:10}}/>:s.replace("_"," ")}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
  );
}

function AdminPanel({onLogout}){
  const [tab,setTab]             = useState("dashboard");
  const [resellers,setResellers] = useState([]);
  const [orders,setOrders]       = useState([]);
  const [withdrawalRequests,setWithdrawalRequests] = useState([]);
  const [resellerRequests,setResellerRequests] = useState([]);
  const [toast,setToast]         = useState({msg:"",type:""});
  const [loading,setLoading]     = useState(true);
  const [search,setSearch]       = useState("");
  const [orderSearch,setOrderSearch] = useState("");
  const [statusFilter,setStatusFilter] = useState("All");
  const [wdStatusFilter,setWdStatusFilter] = useState("All");

  // Modals
  const [topupTarget,setTopupTarget]         = useState(null);
  const [showBulkModal,setShowBulkModal]     = useState(false);
  const [showBroadcast,setShowBroadcast]     = useState(false);
  const [showManualOrder,setShowManualOrder] = useState(false);

  // Pricing state
  const [globalMarkup,setGlobalMarkup]       = useState(10);
  const [bundleOverrides,setBundleOverrides] = useState({});
  const [editMarkup,setEditMarkup]           = useState("");
  const [savingMarkup,setSavingMarkup]       = useState(false);

  const showToast=(msg,type="success")=>{
    setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:""}),3500);
  };

  const fetchAll = async()=>{
    setLoading(true);
    try{
      const [r,t,wd,rq] = await Promise.all([
        sb("resellers?select=*&order=created_at.desc"),
        sb("transactions?select=*&order=created_at.desc&limit=500"),
        sb("withdrawal_requests?select=*&order=created_at.desc").catch(()=>[]),
        sb("reseller_requests?select=*&order=created_at.desc").catch(()=>[])
      ]);
      setResellers(r||[]);
      setOrders((t||[]).map(o=>({...o, admin_status: o.admin_status||"Completed"})));
      setWithdrawalRequests(wd||[]);
      setResellerRequests(rq||[]);
    }catch(e){ showToast("Fetch error: "+e.message,"error"); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{fetchAll();},[]);

  const updateOrderStatus = async(id, status)=>{
    try{
      await sb(`transactions?id=eq.${id}`,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({admin_status:status})});
      setOrders(prev=>prev.map(o=>o.id===id?{...o,admin_status:status}:o));
      showToast("Status updated ✓");
    }catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const updateWithdrawalStatus = async(id, status)=>{
    try{
      await sb(`withdrawal_requests?id=eq.${id}`,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({status})});
      setWithdrawalRequests(prev=>prev.map(w=>w.id===id?{...w,status}:w));
      showToast("Withdrawal status updated ✓");
    }catch(e){ showToast("Error: "+e.message,"error"); }
  };

  const saveGlobalMarkup = async()=>{
    const val = parseFloat(editMarkup);
    if(isNaN(val)||val<0){ showToast("Enter a valid % markup","error"); return; }
    setSavingMarkup(true);
    setTimeout(()=>{ setGlobalMarkup(val); setSavingMarkup(false); showToast(`Global markup set to ${val}%`); },400);
  };

  const setOverride=(id,val)=>{ setBundleOverrides(prev=>({...prev,[id]:val})); };

  const computePrice=(bundle)=>{
    if(bundleOverrides[bundle.id]!==undefined && bundleOverrides[bundle.id]!=="")
      return parseFloat(bundleOverrides[bundle.id])||bundle.base;
    return +(bundle.base * (1 + globalMarkup/100)).toFixed(2);
  };

  const deleteReseller = async(r)=>{
    if(!window.confirm(`Delete reseller "${r.store_name}"? This cannot be undone.`)) return;
    try{
      await sb(`resellers?id=eq.${r.id}`,{method:"DELETE"});
      setResellers(prev=>prev.filter(x=>x.id!==r.id));
      showToast(`Deleted ${r.store_name}`);
    }catch(e){ showToast("Delete failed: "+e.message,"error"); }
  };

  const exportOrdersCSV = ()=>{
    const rows = [["id","network","bundle","amount","customer_phone","status","admin_status","created_at"]];
    orders.forEach(o=>rows.push([o.id,o.network,o.bundle,o.amount,o.customer_phone,o.status,o.admin_status||"Completed",o.created_at]));
    const csv = rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=`orders_export_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // Filtered views
  const filteredResellers = resellers.filter(r=>
    !search || r.store_name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone_number.includes(search)
  );

  const filteredOrders = orders.filter(o=>{
    const matchSearch = !orderSearch ||
      (o.customer_phone||"").includes(orderSearch) ||
      (o.network||"").toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.id||"").includes(orderSearch);
    const matchStatus = statusFilter==="All" || (o.admin_status||"Completed")===statusFilter;
    return matchSearch && matchStatus;
  });

  // Summary stats
  const totalRev    = orders.filter(o=>o.admin_status==="Completed").reduce((s,o)=>s+(o.amount||0),0);
  const totalOrders = orders.length;
  const activeRes   = resellers.filter(r=>(r.total_sales||0)>0).length;
  const pendingCount= orders.filter(o=>o.admin_status==="Pending"||o.admin_status==="Processing").length;
  const pendingWithdrawals = withdrawalRequests.filter(w=>w.status==="Pending").length;

  // Total platform profit (revenue - base costs)
  const platformProfit = orders.filter(o=>o.admin_status==="Completed").reduce((sum,o)=>{
    const netB = BASE_BUNDLES[o.network]||[];
    const matched = netB.find(b=>(o.bundle||"").startsWith(b.label+" "));
    const cost = matched?matched.base:(o.amount||0);
    const p = (o.amount||0)-cost;
    return sum+(p>0?p:0);
  },0);

  const filteredWithdrawals = withdrawalRequests.filter(w=>
    wdStatusFilter==="All"||(w.status||"Pending")===wdStatusFilter
  );

  const navItems=[
    {id:"dashboard",icon:"📊",label:"Dashboard"},
    {id:"resellers",icon:"👥",label:"Resellers"},
    {id:"orders",icon:"📋",label:"Orders"},
    {id:"withdrawals",icon:"💸",label:"Withdrawals"},
    {id:"pricing",icon:"💲",label:"Pricing"},
    {id:"requests",icon:"💡",label:"Requests"},
    {id:"tools",icon:"🛠️",label:"Tools"},
  ];

  const pendingRequestsCount = resellerRequests.filter(r=>(r.status||"Pending")==="Pending").length;

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:G.bg}}>
      <Toast msg={toast.msg} type={toast.type}/>

      {/* Modals */}
      {showManualOrder&&(
        <ManualOrderModal
          resellers={resellers}
          onClose={()=>setShowManualOrder(false)}
          onSuccess={()=>{ setShowManualOrder(false); fetchAll(); }}
          showToast={showToast}/>
      )}
      {topupTarget&&(
        <WalletTopupModal
          reseller={topupTarget}
          onClose={()=>setTopupTarget(null)}
          onSuccess={()=>{ setTopupTarget(null); fetchAll(); }}
          showToast={showToast}/>
      )}
      {showBulkModal&&(
        <BulkStatusModal
          orders={orders}
          onClose={()=>setShowBulkModal(false)}
          onDone={()=>{ setShowBulkModal(false); fetchAll(); }}
          showToast={showToast}/>
      )}
      {showBroadcast&&(
        <BroadcastModal
          resellers={resellers}
          onClose={()=>setShowBroadcast(false)}
          showToast={showToast}/>
      )}

      {/* Header */}
      <header style={{background:G.card,borderBottom:`1px solid ${G.border}`,
        padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,background:`linear-gradient(135deg,${G.gold},#ff9a3c)`,
            borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🛡️</div>
          <div>
            <div className="syne" style={{fontWeight:800,fontSize:16,color:G.gold}}>Admin Panel</div>
            <div style={{fontSize:11,color:G.muted}}>DataResell Pro · Control Centre</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {pendingCount>0&&(
            <div style={{background:`${G.gold}22`,border:`1px solid ${G.gold}60`,borderRadius:20,
              padding:"5px 12px",fontSize:12,color:G.gold,fontWeight:700}}>
              ⚠️ {pendingCount} pending
            </div>
          )}
          {pendingWithdrawals>0&&(
            <div style={{background:`${G.red}22`,border:`1px solid ${G.red}60`,borderRadius:20,
              padding:"5px 12px",fontSize:12,color:G.red,fontWeight:700,cursor:"pointer"}}
              onClick={()=>setTab("withdrawals")}>
              💸 {pendingWithdrawals} withdrawal{pendingWithdrawals!==1?"s":""}
            </div>
          )}
          {pendingRequestsCount>0&&(
            <div style={{background:`${G.accent2}22`,border:`1px solid ${G.accent2}60`,borderRadius:20,
              padding:"5px 12px",fontSize:12,color:G.accent2,fontWeight:700,cursor:"pointer"}}
              onClick={()=>setTab("requests")}>
              💡 {pendingRequestsCount} request{pendingRequestsCount!==1?"s":""}
            </div>
          )}
          <button style={{...btnStyle("ghost"),padding:"8px 14px",fontSize:13}} onClick={fetchAll}>↺ Refresh</button>
          <button style={{...btnStyle("ghost"),padding:"8px 14px",fontSize:13}} onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div style={{display:"flex",flex:1,maxWidth:1260,margin:"0 auto",width:"100%",padding:"0 0 80px"}}>
        {/* Sidebar */}
        <aside className="sidebar-desktop" style={{width:230,padding:"24px 12px",
          flexDirection:"column",gap:4,flexShrink:0}}>
          {navItems.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:12,
                border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:15,
                fontWeight:tab===n.id?600:400,
                background:tab===n.id?`${G.gold}18`:"transparent",
                color:tab===n.id?G.gold:G.muted,transition:"all .2s",textAlign:"left",width:"100%",
                position:"relative"}}>
              <span>{n.icon}</span>{n.label}
              {n.id==="orders"&&pendingCount>0&&(
                <span style={{marginLeft:"auto",background:G.gold,color:"#000",borderRadius:20,
                  fontSize:10,fontWeight:800,padding:"2px 7px"}}>{pendingCount}</span>
              )}
              {n.id==="withdrawals"&&pendingWithdrawals>0&&(
                <span style={{marginLeft:"auto",background:G.red,color:"#fff",borderRadius:20,
                  fontSize:10,fontWeight:800,padding:"2px 7px"}}>{pendingWithdrawals}</span>
              )}
              {n.id==="requests"&&pendingRequestsCount>0&&(
                <span style={{marginLeft:"auto",background:G.accent2,color:"#fff",borderRadius:20,
                  fontSize:10,fontWeight:800,padding:"2px 7px"}}>{pendingRequestsCount}</span>
              )}
            </button>
          ))}

          {/* Quick actions in sidebar */}
          <div style={{marginTop:20,padding:"0 4px"}}>
            <div style={{fontSize:10,color:G.muted,fontWeight:700,letterSpacing:1,marginBottom:8,paddingLeft:12}}>
              QUICK ACTIONS
            </div>
            <button onClick={()=>setShowManualOrder(true)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:12,
                border:`1px solid ${G.gold}40`,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                fontSize:14,background:`${G.gold}10`,color:G.gold,width:"100%",marginBottom:8,
                transition:"all .2s"}}>
              ➕ Manual Order Entry
            </button>
            <button onClick={()=>setShowBulkModal(true)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:12,
                border:`1px solid ${G.accent}40`,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                fontSize:14,background:`${G.accent}10`,color:G.accent,width:"100%",marginBottom:8,
                transition:"all .2s"}}>
              📤 Bulk Status Upload
            </button>
            <button onClick={()=>setShowBroadcast(true)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:12,
                border:`1px solid ${G.accent2}40`,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                fontSize:14,background:`${G.accent2}10`,color:G.accent2,width:"100%",
                transition:"all .2s"}}>
              📢 Broadcast Message
            </button>
          </div>
        </aside>

        <main style={{flex:1,padding:"28px 20px",minWidth:0}}>

          {/* DASHBOARD TAB */}
          {tab==="dashboard"&&(
            <>
              <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24,marginBottom:24}}>
                Platform Overview
              </div>
              {loading ? <div style={{color:G.muted}}>Loading…</div> : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:16,marginBottom:32}}>
                    <StatCard icon="💰" label="Total Revenue" value={fmt(totalRev)} sub="Completed orders" color={G.green} delay="fa1"/>
                    <StatCard icon="💹" label="Platform Profit" value={fmt(platformProfit)} sub="Revenue minus base cost" color={G.gold} delay="fa2"/>
                    <StatCard icon="📋" label="Total Orders" value={String(totalOrders)} sub="All time" color={G.accent} delay="fa3"/>
                    <StatCard icon="👥" label="Total Resellers" value={String(resellers.length)} sub="Registered" color={G.accent2} delay="fa4"/>
                    <StatCard icon="🔥" label="Active Resellers" value={String(activeRes)} sub="Made a sale" color={G.green} delay="fa5"/>
                    <StatCard icon="⏳" label="Pending Orders" value={String(pendingCount)} sub="Need attention" color={G.red} delay="fa5"/>
                    <StatCard icon="💸" label="Pending Withdrawals" value={String(pendingWithdrawals)} sub="Awaiting processing" color={G.red} delay="fa5"/>
                  </div>

                  {/* Status breakdown */}
                  <div className="fade-up fa5" style={{background:G.card,border:`1px solid ${G.border}`,
                    borderRadius:16,padding:24,marginBottom:28}}>
                    <div className="syne" style={{fontWeight:700,fontSize:16,marginBottom:16}}>Order Status Breakdown</div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      {ORDER_STATUSES.map(s=>{
                        const count = orders.filter(o=>(o.admin_status||"Completed")===s).length;
                        const pct = orders.length ? Math.round(count/orders.length*100) : 0;
                        return(
                          <div key={s} style={{flex:"1 1 100px",background:G.surface,borderRadius:12,
                            padding:"14px 16px",border:`1px solid ${STATUS_COLORS[s]}40`}}>
                            <div style={{fontSize:11,color:STATUS_COLORS[s],fontWeight:700,marginBottom:4}}>{s.toUpperCase()}</div>
                            <div className="syne" style={{fontSize:22,fontWeight:800,color:G.text}}>{count}</div>
                            <div style={{fontSize:11,color:G.muted,marginTop:2}}>{pct}% of total</div>
                            {/* Mini bar */}
                            <div style={{marginTop:8,height:3,background:G.border,borderRadius:4}}>
                              <div style={{width:`${pct}%`,height:"100%",borderRadius:4,
                                background:STATUS_COLORS[s],transition:"width .5s"}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent orders */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div className="syne fade-up fa5" style={{fontWeight:700,fontSize:18}}>Recent Orders</div>
                    <button style={{...btnStyle("ghost"),padding:"8px 14px",fontSize:13}}
                      onClick={()=>setTab("orders")}>View All →</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {orders.slice(0,6).map((o,i)=>{
                      const st = o.admin_status||"Completed";
                      return(
                        <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:12,
                          padding:"13px 18px",display:"flex",alignItems:"center",
                          justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                          <div style={{display:"flex",gap:12,alignItems:"center"}}>
                            <div style={{width:36,height:36,background:`${STATUS_COLORS[st]||G.muted}22`,
                              borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                              {st==="Completed"?"✅":st==="Failed"?"❌":st==="Refunded"?"↩️":st==="Processing"?"⚙️":"🕐"}
                            </div>
                            <div>
                              <div style={{fontWeight:600,fontSize:14}}>{o.network} · {(o.bundle||"").split(" -")[0]}</div>
                              <div style={{fontSize:12,color:G.muted}}>{o.customer_phone} · {new Date(o.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <span style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,
                              background:`${STATUS_COLORS[st]||G.muted}22`,color:STATUS_COLORS[st]||G.muted}}>{st}</span>
                            <span style={{fontWeight:700,color:G.green,fontSize:14}}>{fmt(o.amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* RESELLERS TAB */}
          {tab==="resellers"&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
                <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24}}>
                  Resellers ({resellers.length})
                </div>
                <button style={{...btnStyle("primary"),padding:"10px 18px",fontSize:13,
                  background:`linear-gradient(135deg,${G.accent2},#5b4dcc)`}}
                  onClick={()=>setShowBroadcast(true)}>
                  📢 Broadcast
                </button>
              </div>

              {/* Search */}
              <div style={{marginBottom:18}}>
                <input style={inputStyle} type="text" placeholder="🔍  Search by name or phone…"
                  value={search} onChange={e=>setSearch(e.target.value)}
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
              </div>

              {loading ? <div style={{color:G.muted}}>Loading…</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {filteredResellers.map((r,i)=>(
                    <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
                      padding:"18px 22px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        flexWrap:"wrap",gap:12}}>
                        <div style={{display:"flex",gap:14,alignItems:"center"}}>
                          <div style={{width:46,height:46,background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
                            borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
                            fontWeight:800,fontSize:20,color:"#fff",flexShrink:0}}>{r.store_name[0].toUpperCase()}</div>
                          <div>
                            <div className="syne" style={{fontWeight:700,fontSize:16}}>{r.store_name}</div>
                            <div style={{fontSize:13,color:G.muted}}>📞 {r.phone_number}</div>
                            <div style={{fontSize:12,color:G.accent,fontFamily:"monospace",marginTop:2}}>/{r.store_slug}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:10,color:G.muted,fontWeight:700}}>BALANCE</div>
                            <div style={{fontWeight:700,color:G.green,fontSize:16}}>{fmt(r.wallet_balance)}</div>
                          </div>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:10,color:G.muted,fontWeight:700}}>SALES</div>
                            <div style={{fontWeight:700,color:G.accent,fontSize:16}}>{fmt(r.total_sales)}</div>
                          </div>
                          <div style={{textAlign:"center"}}>
                            <div style={{fontSize:10,color:G.muted,fontWeight:700}}>CUSTOMERS</div>
                            <div style={{fontWeight:700,fontSize:16}}>{r.total_customers||0}</div>
                          </div>
                        </div>
                      </div>
                      {/* Action row */}
                      <div style={{display:"flex",gap:8,marginTop:16,flexWrap:"wrap"}}>
                        <button style={{...btnStyle("green"),padding:"8px 16px",fontSize:13}}
                          onClick={()=>setTopupTarget(r)}>
                          💳 Fund Wallet
                        </button>
                        <a href={`/store/${r.store_slug}`} target="_blank" rel="noreferrer"
                          style={{...btnStyle("ghost"),padding:"8px 16px",fontSize:13,textDecoration:"none"}}>
                          🔗 View Store
                        </a>
                        <button style={{...btnStyle("ghost"),padding:"8px 16px",fontSize:13,
                          color:G.red,borderColor:G.red+"60"}}
                          onClick={()=>deleteReseller(r)}>
                          🗑 Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredResellers.length===0&&(
                    <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
                      background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                      <div style={{fontSize:48,marginBottom:12}}>👥</div>
                      <div>{search?"No resellers match your search":"No resellers yet"}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ORDERS TAB */}
          {tab==="orders"&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
                <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24}}>
                  Orders ({orders.length})
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button style={{...btnStyle("primary"),padding:"10px 16px",fontSize:13,
                    background:`linear-gradient(135deg,${G.accent},${G.accent2})`}}
                    onClick={()=>setShowBulkModal(true)}>
                    📤 Bulk Status Upload
                  </button>
                  <button style={{...btnStyle("ghost"),padding:"10px 14px",fontSize:13}}
                    onClick={exportOrdersCSV}>
                    ⬇ Export CSV
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                <input style={{...inputStyle,flex:1,minWidth:180}} type="text"
                  placeholder="🔍  Search phone, network, order ID…"
                  value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}/>
                <select style={{...inputStyle,width:"auto",paddingRight:14}} value={statusFilter}
                  onChange={e=>setStatusFilter(e.target.value)}
                  onFocus={e=>e.target.style.borderColor=G.accent}
                  onBlur={e=>e.target.style.borderColor=G.border}>
                  <option value="All">All Statuses</option>
                  {ORDER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {loading ? <div style={{color:G.muted}}>Loading…</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredOrders.map((o,i)=>{
                    const st = o.admin_status||"Completed";
                    return(
                      <div key={i} style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:14,
                        padding:"16px 20px",display:"flex",alignItems:"center",
                        justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                        <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0,flex:1}}>
                          <div style={{width:42,height:42,background:`${STATUS_COLORS[st]||G.muted}22`,
                            borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:20,flexShrink:0}}>
                            {st==="Completed"?"✅":st==="Failed"?"❌":st==="Refunded"?"↩️":st==="Processing"?"⚙️":"🕐"}
                          </div>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:600,fontSize:14}}>{o.network} · {(o.bundle||"").split(" -")[0]}</div>
                            <div style={{fontSize:12,color:G.muted}}>{o.customer_phone}</div>
                            <div style={{fontSize:11,color:G.muted,marginTop:2,fontFamily:"monospace",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:220}}>
                              ID: {o.id}
                            </div>
                            <div style={{fontSize:11,color:G.muted}}>{new Date(o.created_at).toLocaleString()}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                          <span style={{fontWeight:700,color:G.green,fontSize:15}}>{fmt(o.amount)}</span>
                          <select
                            value={st}
                            onChange={e=>updateOrderStatus(o.id,e.target.value)}
                            style={{...inputStyle,width:"auto",padding:"7px 12px",fontSize:13,
                              borderColor:STATUS_COLORS[st]||G.border,
                              color:STATUS_COLORS[st]||G.text}}>
                            {ORDER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {filteredOrders.length===0&&(
                    <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
                      background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                      <div style={{fontSize:48,marginBottom:12}}>📭</div>
                      <div>{orderSearch||statusFilter!=="All"?"No orders match your filters":"No orders yet"}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* WITHDRAWALS TAB */}
          {tab==="withdrawals"&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
                <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24}}>
                  Withdrawal Requests ({withdrawalRequests.length})
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["All","Pending","Processing","Paid","Rejected"].map(s=>(
                    <button key={s} onClick={()=>setWdStatusFilter(s)}
                      style={{padding:"8px 16px",borderRadius:10,cursor:"pointer",
                        border:`1px solid ${wdStatusFilter===s?(s==="Pending"?G.gold:s==="Paid"?G.green:s==="Rejected"?G.red:G.accent):G.border}`,
                        background:wdStatusFilter===s?`${s==="Pending"?G.gold:s==="Paid"?G.green:s==="Rejected"?G.red:G.accent}22`:"transparent",
                        color:wdStatusFilter===s?(s==="Pending"?G.gold:s==="Paid"?G.green:s==="Rejected"?G.red:G.accent):G.muted,
                        fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,transition:"all .2s"}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? <div style={{color:G.muted}}>Loading…</div> : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {filteredWithdrawals.map((w,i)=>{
                    const stColor = {Pending:G.gold,Processing:G.accent,Paid:G.green,Rejected:G.red}[w.status||"Pending"]||G.muted;
                    return(
                      <div key={i} style={{background:G.card,border:`1px solid ${stColor}40`,borderRadius:16,padding:"20px 22px"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                            <div style={{width:48,height:48,background:`${stColor}22`,borderRadius:12,
                              display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
                              {w.status==="Paid"?"✅":w.status==="Rejected"?"❌":w.status==="Processing"?"⚙️":"🕐"}
                            </div>
                            <div>
                              <div className="syne" style={{fontWeight:800,fontSize:18,color:G.green}}>{fmt(w.amount)}</div>
                              <div style={{fontSize:13,color:G.text,fontWeight:600,marginTop:2}}>{w.store_name}</div>
                              <div style={{fontSize:12,color:G.muted}}>Reseller: {w.phone_number}</div>
                              <div style={{fontSize:13,color:G.accent,marginTop:4}}>
                                MoMo: <strong>{w.momo_number}</strong> — {w.momo_name}
                              </div>
                              {w.note&&<div style={{fontSize:12,color:G.muted,marginTop:4,fontStyle:"italic"}}>"{w.note}"</div>}
                              <div style={{fontSize:11,color:G.muted,marginTop:4}}>{new Date(w.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                            <span style={{fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20,
                              background:`${stColor}22`,color:stColor}}>{w.status||"Pending"}</span>
                            <select
                              value={w.status||"Pending"}
                              onChange={e=>updateWithdrawalStatus(w.id,e.target.value)}
                              style={{...inputStyle,width:"auto",padding:"7px 12px",fontSize:13,
                                borderColor:stColor,color:stColor}}>
                              {["Pending","Processing","Paid","Rejected"].map(s=>(
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredWithdrawals.length===0&&(
                    <div style={{textAlign:"center",padding:"64px 20px",color:G.muted,
                      background:G.card,borderRadius:16,border:`1px solid ${G.border}`}}>
                      <div style={{fontSize:48,marginBottom:12}}>💸</div>
                      <div>{wdStatusFilter!=="All"?"No withdrawals with this status":"No withdrawal requests yet"}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* PRICING TAB */}
          {tab==="pricing"&&(
            <>
              <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24,marginBottom:8}}>
                Pricing & Markup
              </div>
              <div style={{color:G.muted,fontSize:14,marginBottom:28}}>
                Set a global % markup applied to all bundles, or override individual bundle prices.
              </div>

              <div className="fade-up fa2" style={{background:G.card,border:`1px solid ${G.gold}40`,
                borderRadius:16,padding:24,marginBottom:28}}>
                <div className="syne" style={{fontWeight:700,fontSize:17,marginBottom:4}}>
                  🌐 Global Markup
                </div>
                <div style={{color:G.muted,fontSize:13,marginBottom:16}}>
                  Applied to all bundles unless overridden below.
                  Currently: <span style={{color:G.gold,fontWeight:700}}>{globalMarkup}%</span>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <input style={{...inputStyle,width:160}} type="number" min="0" max="200"
                    placeholder={`Current: ${globalMarkup}%`}
                    value={editMarkup} onChange={e=>setEditMarkup(e.target.value)}
                    onFocus={e=>e.target.style.borderColor=G.gold}
                    onBlur={e=>e.target.style.borderColor=G.border}/>
                  <span style={{color:G.muted,fontSize:14}}>%</span>
                  <button style={{...btnStyle("primary"),padding:"13px 24px",
                    background:`linear-gradient(135deg,${G.gold},#ff9a3c)`}}
                    onClick={saveGlobalMarkup} disabled={savingMarkup}>
                    {savingMarkup?"Saving…":"Save Markup"}
                  </button>
                </div>
              </div>

              {Object.entries(BASE_BUNDLES).map(([network,blist])=>(
                <div key={network} className="fade-up fa3" style={{background:G.card,
                  border:`1px solid ${G.border}`,borderRadius:16,padding:24,marginBottom:18}}>
                  <div className="syne" style={{fontWeight:700,fontSize:16,marginBottom:16,
                    color:network==="MTN"?G.gold:network==="Telecel"?G.accent:G.accent2}}>
                    {network==="MTN"?"📶":network==="Telecel"?"🔵":"🟠"} {network}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                    {blist.map(b=>{
                      const computed = computePrice(b);
                      const hasOverride = bundleOverrides[b.id]!==undefined && bundleOverrides[b.id]!=="";
                      return(
                        <div key={b.id} style={{background:G.surface,borderRadius:12,padding:"14px 16px",
                          border:`1px solid ${hasOverride?G.gold+"60":G.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10,alignItems:"center"}}>
                            <span style={{fontWeight:600,fontSize:14}}>{b.label}</span>
                            <span style={{fontSize:11,color:G.muted}}>Base: {fmt(b.base)}</span>
                          </div>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <input
                              style={{...inputStyle,padding:"9px 12px",fontSize:13,
                                borderColor:hasOverride?G.gold:G.border}}
                              type="number" min="0" step="0.01"
                              placeholder={`Auto: ${fmt(computed)}`}
                              value={bundleOverrides[b.id]||""}
                              onChange={e=>setOverride(b.id,e.target.value)}
                              onFocus={e=>e.target.style.borderColor=G.gold}
                              onBlur={e=>e.target.style.borderColor=hasOverride?G.gold:G.border}/>
                            {hasOverride&&(
                              <button onClick={()=>setOverride(b.id,"")}
                                style={{background:"none",border:"none",color:G.red,cursor:"pointer",
                                  fontSize:18,flexShrink:0}}>✕</button>
                            )}
                          </div>
                          <div style={{fontSize:11,marginTop:8,color:hasOverride?G.gold:G.muted}}>
                            Reseller price: <strong>{hasOverride?fmt(parseFloat(bundleOverrides[b.id])||b.base):fmt(computed)}</strong>
                            {hasOverride?" (override)":" (markup)"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* REQUESTS TAB */}
          {tab==="requests"&&(
            <AdminRequestsTab
              resellerRequests={resellerRequests}
              resellers={resellers}
              showToast={showToast}
              onRefresh={fetchAll}
            />
          )}

          {/* TOOLS TAB */}
          {tab==="tools"&&(
            <>
              <div className="syne fade-up fa1" style={{fontWeight:800,fontSize:24,marginBottom:24}}>
                Admin Tools
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>

                {/* Manual Order Entry */}
                <div style={{background:G.card,border:`1px solid ${G.gold}60`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>➕</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.gold}}>
                    Manual Order Entry
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Got a Paystack email notification? Add the order directly to the right reseller's dashboard. Reference auto-fills as <strong style={{color:G.gold}}>_G{"{StoreName}"}_</strong>
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13,
                    background:`linear-gradient(135deg,${G.gold},#ff9a3c)`}}
                    onClick={()=>setShowManualOrder(true)}>
                    ➕ Add Manual Order
                  </button>
                </div>

                {/* Bulk Status Upload */}
                <div style={{background:G.card,border:`1px solid ${G.accent}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>📤</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.accent}}>
                    Bulk Status Upload
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Upload a CSV file to update many order statuses at once. Changes are immediately reflected in reseller dashboards.
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13}}
                    onClick={()=>setShowBulkModal(true)}>
                    Open Bulk Upload
                  </button>
                </div>

                {/* Wallet Top-up */}
                <div style={{background:G.card,border:`1px solid ${G.green}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>💳</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.green}}>
                    Fund Reseller Wallets
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Manually add funds to any reseller's wallet. Useful for manual bank transfers and reconciliation.
                  </div>
                  <button style={{...btnStyle("green"),width:"100%",padding:13}}
                    onClick={()=>setTab("resellers")}>
                    Go to Resellers
                  </button>
                </div>

                {/* Broadcast */}
                <div style={{background:G.card,border:`1px solid ${G.accent2}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>📢</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.accent2}}>
                    Broadcast Message
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Send notifications to all, active, or inactive resellers. Ideal for system announcements and promotions.
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13,
                    background:`linear-gradient(135deg,${G.accent2},#5b4dcc)`}}
                    onClick={()=>setShowBroadcast(true)}>
                    Open Broadcast
                  </button>
                </div>

                {/* Export Orders */}
                <div style={{background:G.card,border:`1px solid ${G.gold}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>📊</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.gold}}>
                    Export Orders CSV
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Download all orders as a CSV file for offline analysis, accounting, or bulk status editing.
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13,
                    background:`linear-gradient(135deg,${G.gold},#ff9a3c)`}}
                    onClick={exportOrdersCSV}>
                    ⬇ Download CSV
                  </button>
                </div>

                {/* Reset Balances */}
                <div style={{background:G.card,border:`1px solid ${G.red}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>🔄</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.red}}>
                    Reset All Balances to Zero
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    Set all reseller wallet balances to GHS 0.00. Use this for a platform reset or billing cycle reset. <strong style={{color:G.red}}>This cannot be undone.</strong>
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13,
                    background:`linear-gradient(135deg,${G.red},#cc2244)`}}
                    onClick={async()=>{
                      if(!window.confirm(`Reset ALL ${resellers.length} reseller wallet balances to GHS 0.00? This cannot be undone.`)) return;
                      let count = 0;
                      showToast("Resetting balances…");
                      for(const r of resellers){
                        try{
                          await sb(`resellers?id=eq.${r.id}`,{method:"PATCH",prefer:"return=representation",
                            body:JSON.stringify({wallet_balance:0})});
                          count++;
                        }catch{}
                      }
                      showToast(`✅ Reset ${count} of ${resellers.length} reseller balances to GHS 0.00`);
                      fetchAll();
                    }}>
                    🔄 Reset All Balances to Zero
                  </button>
                </div>

                {/* Platform Stats */}
                <div style={{background:G.card,border:`1px solid ${G.border}`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>📈</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8}}>
                    Platform Stats
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      ["Total Resellers",resellers.length,G.accent2],
                      ["Active Resellers",activeRes,G.green],
                      ["Total Orders",orders.length,G.accent],
                      ["Pending / Processing",pendingCount,G.gold],
                      ["Total Revenue",fmt(orders.filter(o=>o.admin_status==="Completed").reduce((s,o)=>s+(o.amount||0),0)),G.green],
                      ["Platform Profit",fmt(platformProfit),G.gold],
                      ["Pending Withdrawals",pendingWithdrawals,G.red],
                    ].map(([label,val,color])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",
                        alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${G.border}`}}>
                        <span style={{fontSize:13,color:G.muted}}>{label}</span>
                        <span style={{fontWeight:700,color,fontSize:15}}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Withdrawal Requests */}
                <div style={{background:G.card,border:`1px solid ${G.red}40`,borderRadius:18,padding:28}}>
                  <div style={{fontSize:36,marginBottom:14}}>💸</div>
                  <div className="syne" style={{fontWeight:700,fontSize:18,marginBottom:8,color:G.red}}>
                    Withdrawal Requests
                  </div>
                  <div style={{color:G.muted,fontSize:14,lineHeight:1.6,marginBottom:20}}>
                    {pendingWithdrawals>0
                      ? <span style={{color:G.red,fontWeight:700}}>{pendingWithdrawals} pending</span>
                      : "No pending requests"} — review and mark as Paid or Rejected.
                  </div>
                  <button style={{...btnStyle("primary"),width:"100%",padding:13,
                    background:`linear-gradient(135deg,${G.red},#cc2244)`}}
                    onClick={()=>setTab("withdrawals")}>
                    💸 View Withdrawals
                  </button>
                </div>

              </div>
            </>
          )}

        </main>
      </div>

      {/* Mobile nav */}
      <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,
        background:G.card,borderTop:`1px solid ${G.border}`,
        display:"flex",zIndex:50,padding:"8px 0"}}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              gap:3,padding:"8px 4px",border:"none",background:"none",cursor:"pointer",
              color:tab===n.id?G.gold:G.muted,fontSize:10,
              fontFamily:"'DM Sans',sans-serif",fontWeight:tab===n.id?600:400,transition:"color .2s",
              position:"relative"}}>
            <span style={{fontSize:18,position:"relative"}}>
              {n.icon}
              {n.id==="orders"&&pendingCount>0&&<span style={{position:"absolute",top:-4,right:-6,background:G.gold,color:"#000",borderRadius:20,fontSize:8,fontWeight:800,padding:"1px 4px"}}>{pendingCount}</span>}
              {n.id==="withdrawals"&&pendingWithdrawals>0&&<span style={{position:"absolute",top:-4,right:-6,background:G.red,color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"1px 4px"}}>{pendingWithdrawals}</span>}
              {n.id==="requests"&&pendingRequestsCount>0&&<span style={{position:"absolute",top:-4,right:-6,background:G.accent2,color:"#fff",borderRadius:20,fontSize:8,fontWeight:800,padding:"1px 4px"}}>{pendingRequestsCount}</span>}
            </span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ── App Root ── */

/* ── TrackOrder (customer order tracking) ── */
function TrackOrder({resellerId, storeName, prefillId=""}){
  const [query, setQuery] = useState(prefillId);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(()=>{
    if(prefillId){ setQuery(prefillId); handleSearch(prefillId); }
  },[prefillId]);

  const STATUS_META = {
    pending:  {label:"Pending",    color:"#ffd166", bg:"rgba(255,209,102,0.12)", icon:"⏳"},
    success:  {label:"Delivered",  color:"#00d68f", bg:"rgba(0,214,143,0.12)",  icon:"✅"},
    completed:{label:"Delivered",  color:"#00d68f", bg:"rgba(0,214,143,0.12)",  icon:"✅"},
    failed:   {label:"Failed",     color:"#ff4d6d", bg:"rgba(255,77,109,0.12)", icon:"❌"},
    refunded: {label:"Refunded",   color:"#7b61ff", bg:"rgba(123,97,255,0.12)", icon:"↩️"},
    processing:{label:"Processing",color:"#00e5ff", bg:"rgba(0,229,255,0.12)",  icon:"🔄"},
  };

  const getSteps = (status, type) => {
    const isData = type === "data_purchase";
    const steps = [
      {key:"placed",    label:"Order Placed",       desc:"Payment confirmed by Paystack", done:true},
      {key:"processing",label:"Processing",          desc:isData?"Routing to network operator":"Queuing your order", done:["processing","success","completed","failed","refunded"].includes(status)},
      {key:"delivery",  label:isData?"Sending Data":"Delivering", desc:isData?"Data bundle being sent to your number":"Service being fulfilled", done:["success","completed"].includes(status)},
      {key:"done",      label:"Completed",           desc:"Order successfully delivered", done:["success","completed"].includes(status)},
    ];
    return steps;
  };

  const handleSearch = async(val) => {
    const q = (val||query).trim();
    if(!q){ setError("Enter your Order ID or phone number"); return; }
    setLoading(true); setError(""); setResults(null);
    try{
      let rows = [];
      // Try Order ID first (order_ref field)
      if(q.toUpperCase().startsWith("ORD-")){
        rows = await sb(`transactions?reseller_id=eq.${resellerId}&order_ref=eq.${q.toUpperCase()}&select=*&order=created_at.desc`);
      } else {
        // Search by phone
        rows = await sb(`transactions?reseller_id=eq.${resellerId}&customer_phone=eq.${encodeURIComponent(q)}&select=*&order=created_at.desc&limit=10`);
      }
      if(!rows||rows.length===0){
        setError("No orders found. Check your Order ID or phone number.");
      } else {
        setResults(rows);
      }
    }catch(e){
      setError("Failed to look up order. Please try again.");
    }finally{ setLoading(false); }
  };

  const fmtDate = iso => {
    if(!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("en-GH",{day:"numeric",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("en-GH",{hour:"2-digit",minute:"2-digit"});
  };

  return(
    <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4}}>Track Your Order</div>
        <div style={{color:"#6b7fa3",fontSize:14}}>Enter your Order ID (e.g. ORD-XXXX) or the phone number you used.</div>
      </div>

      {/* Search input */}
      <div style={{display:"flex",gap:10,marginBottom:24}}>
        <input
          style={{flex:1,padding:"13px 16px",background:"rgba(255,255,255,0.06)",
            border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:14,color:"#e8edf7",
            fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none"}}
          placeholder="ORD-XXXX or phone number"
          value={query}
          onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&handleSearch()}
          onFocus={e=>e.target.style.borderColor="#00e5ff"}
          onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}
        />
        <button onClick={()=>handleSearch()} disabled={loading}
          style={{padding:"13px 20px",background:"linear-gradient(135deg,#00e5ff,#7b61ff)",
            border:"none",borderRadius:14,color:"#fff",fontWeight:700,fontSize:15,
            cursor:"pointer",fontFamily:"'DM Sans',sans-serif",flexShrink:0,
            display:"flex",alignItems:"center",gap:8}}>
          {loading?<span className="spinner"/>:"🔍"}
        </button>
      </div>

      {error&&(
        <div style={{background:"rgba(255,77,109,0.1)",border:"1px solid rgba(255,77,109,0.3)",
          borderRadius:12,padding:"12px 16px",color:"#ff4d6d",fontSize:14,fontWeight:500,marginBottom:20}}>
          {error}
        </div>
      )}

      {/* Results */}
      {results&&results.map((order,i)=>{
        const sm = STATUS_META[order.status?.toLowerCase()]||STATUS_META.pending;
        const steps = getSteps(order.status?.toLowerCase(), order.type);
        const isMulti = results.length > 1;
        return(
          <div key={order.id||i} style={{background:"rgba(255,255,255,0.04)",
            border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:20,
            padding:"20px 20px",marginBottom:16,overflow:"hidden",position:"relative"}}>

            {/* Status glow */}
            <div style={{position:"absolute",top:-30,right:-30,width:100,height:100,
              background:sm.color+"18",borderRadius:"50%",filter:"blur(30px)"}}/>

            {/* Order header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,position:"relative"}}>
              <div>
                <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:4}}>ORDER ID</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"#00e5ff",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                  onClick={()=>{navigator.clipboard.writeText(order.order_ref||"");setCopied(order.id);}}>
                  {order.order_ref||"Legacy Order"}
                  {order.order_ref&&<span style={{fontSize:10,color:"#6b7fa3"}}>{copied===order.id?"✓ Copied":"📋"}</span>}
                </div>
              </div>
              <div className="track-status-pill" style={{background:sm.bg,color:sm.color,border:`1px solid ${sm.color}40`}}>
                <span className="track-live-dot" style={{background:sm.color,animation:sm.label==="Pending"||sm.label==="Processing"?"trackPulse 1.8s infinite":"none"}}/>
                {sm.icon} {sm.label}
              </div>
            </div>

            {/* Order details */}
            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px 16px"}}>
                <div>
                  <div style={{fontSize:10,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:2}}>BUNDLE / SERVICE</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8edf7",lineHeight:1.4}}>{order.bundle}</div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:2}}>AMOUNT</div>
                  <div style={{fontSize:15,fontWeight:800,fontFamily:"'Syne',sans-serif",color:"#00d68f"}}>GHS {parseFloat(order.amount||0).toFixed(2)}</div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:2}}>{order.type==="social_order"?"TARGET":"RECIPIENT"}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#00e5ff"}}>{order.customer_phone}</div>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:2}}>DATE</div>
                  <div style={{fontSize:11,fontWeight:500,color:"#6b7fa3"}}>{fmtDate(order.created_at)}</div>
                </div>
              </div>
              {order.payment_ref&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:10,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:2}}>PAYMENT REF</div>
                  <div style={{fontSize:11,color:"#6b7fa3",fontFamily:"monospace"}}>{order.payment_ref}</div>
                </div>
              )}
            </div>

            {/* Progress steps */}
            <div style={{marginBottom:4}}>
              <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,letterSpacing:0.4,marginBottom:12}}>DELIVERY PROGRESS</div>
              <div style={{paddingLeft:4}}>
                {steps.map((step,si)=>(
                  <div key={step.key} className="track-step" style={{paddingBottom:si<steps.length-1?0:0}}>
                    <div className="track-step-dot"
                      style={{background:step.done?"linear-gradient(135deg,#00e5ff,#7b61ff)":"rgba(255,255,255,0.08)",
                        boxShadow:step.done?"0 0 16px rgba(0,229,255,0.3)":"none"}}>
                      {step.done
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <div style={{width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,0.2)"}}/>}
                    </div>
                    {si<steps.length-1&&<div style={{position:"absolute",left:20,width:2,height:24,background:"rgba(255,255,255,0.08)",marginTop:32}}/>}
                    <div style={{paddingBottom:si<steps.length-1?16:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:step.done?"#e8edf7":"#6b7fa3"}}>{step.label}</div>
                      <div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact reseller note */}
            {(order.status==="pending"||order.status==="processing")&&(
              <div style={{background:"rgba(0,229,255,0.06)",border:"1px solid rgba(0,229,255,0.15)",
                borderRadius:10,padding:"10px 14px",marginTop:8,display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:16}}>💬</span>
                <div style={{fontSize:12,color:"#6b7fa3"}}>
                  Having issues? Contact <strong style={{color:"#e8edf7"}}>{storeName}</strong> with your Order ID.
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {!results&&!loading&&!error&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#6b7fa3"}}>
          <div style={{fontSize:48,marginBottom:12}}>🔍</div>
          <div style={{fontWeight:600,fontSize:15,color:"#e8edf7",marginBottom:6}}>Find Your Order</div>
          <div style={{fontSize:13}}>Use the Order ID from your confirmation screen, or your phone number.</div>
        </div>
      )}
    </div>
  );
}

/* ── Reloadly: Airtime Tab ── */
function ReloadlyAirtimeTab({reseller, launchPaystack, showToast, recordReloadlyOrder}){
  const [countries,  setCountries]  = useState([]);
  const [operators,  setOperators]  = useState([]);
  const [selCountry, setSelCountry] = useState(null);
  const [selOp,      setSelOp]      = useState(null);
  const [phone,      setPhone]      = useState("");
  const [amount,     setAmount]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [step,       setStep]       = useState("country"); // country|operator|amount|confirm

  useEffect(()=>{
    setLoading(true);
    rlFetch("airtime","/countries")
      .then(d=>{ setCountries(Array.isArray(d)?d:d.content||[]); })
      .catch(e=>showToast("Could not load countries: "+e.message,"error"))
      .finally(()=>setLoading(false));
  },[]);

  const loadOperators = async(country)=>{
    setSelCountry(country); setStep("operator"); setLoading(true);
    try{
      const d = await rlFetch("airtime","/operators/countries/"+country.isoName+"?includeBundles=false&includeData=false&includePin=false");
      setOperators(Array.isArray(d)?d:d.content||[]);
    }catch(e){ showToast("Could not load operators: "+e.message,"error"); }
    finally{ setLoading(false); }
  };

  const handleBuy = ()=>{
    if(!phone.trim()){ showToast("Enter recipient phone number","error"); return; }
    const amt = parseFloat(amount);
    if(!amt||amt<1){ showToast("Enter a valid amount","error"); return; }
    setBusy(true);
    launchPaystack(amt, async(ref)=>{
      try{
        await rlFetch("airtime","/topups",{
          method:"POST",
          body:JSON.stringify({
            recipientPhone:{countryCode:selCountry.isoName,number:phone},
            amount:amt,
            operatorId:selOp.id,
            useLocalAmount:false
          })
        });
        await recordReloadlyOrder({type:"airtime",label:`${selOp.name} Airtime ${selCountry.name}`,amount:amt,phone,ref});
        showToast("✅ Airtime sent successfully!");
        setStep("country"); setSelCountry(null); setSelOp(null); setPhone(""); setAmount("");
      }catch(e){ showToast("Top-up failed: "+e.message,"error"); }
      finally{ setBusy(false); }
    });
  };

  const inputS = {width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:"none"};

  return(
  <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4}}>📞 Airtime Top-Up</div>
    <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Send airtime to any number worldwide instantly.</div>

    {/* Breadcrumb */}
    <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
      {[["country","Country"],["operator","Network"],["amount","Amount"]].map(([s,label],i,arr)=>(
        <React.Fragment key={s}>
          <span onClick={()=>{if(["operator","amount"].includes(step)&&s!==step){if(s==="country"){setStep("country");setSelOp(null);}}}}
            style={{fontSize:12,fontWeight:600,color:step===s?"#00e5ff":"#6b7fa3",cursor:"pointer",opacity:step===s?1:0.6}}>
            {label}
          </span>
          {i<arr.length-1&&<span style={{color:"#6b7fa3",fontSize:12}}>›</span>}
        </React.Fragment>
      ))}
    </div>

    {loading&&<div style={{textAlign:"center",padding:"40px"}}><span className="spinner" style={{width:32,height:32,borderTopColor:"#00e5ff"}}/></div>}

    {/* Step: Country */}
    {!loading&&step==="country"&&(
      <div>
        <div style={{fontWeight:600,color:"#6b7fa3",fontSize:13,marginBottom:12}}>Select destination country</div>
        <div style={{maxHeight:380,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
          {countries.slice(0,80).map(c=>(
            <div key={c.isoName} onClick={()=>loadOperators(c)}
              style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,229,255,0.4)"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
              <span style={{fontSize:22}}>{c.flagEmoji||"🌍"}</span>
              <span style={{fontWeight:600,color:"#e8edf7",fontSize:14}}>{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Step: Operator */}
    {!loading&&step==="operator"&&(
      <div>
        <button onClick={()=>{setStep("country");setOperators([]);}} style={{background:"none",border:"none",color:"#6b7fa3",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:14,padding:0}}>← Back</button>
        <div style={{fontWeight:600,color:"#6b7fa3",fontSize:13,marginBottom:12}}>Select network operator in {selCountry.name}</div>
        {operators.length===0?<div style={{color:"#6b7fa3",textAlign:"center",padding:"32px"}}>No airtime operators found.</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {operators.map(op=>(
              <div key={op.id} onClick={()=>{setSelOp(op);setStep("amount");}}
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,229,255,0.4)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
                <div>
                  <div style={{fontWeight:700,color:"#e8edf7",fontSize:14}}>{op.name}</div>
                  {op.minAmount&&<div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>Min: {op.senderCurrencySymbol||"$"}{op.minAmount} · Max: {op.senderCurrencySymbol||"$"}{op.maxAmount}</div>}
                </div>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 15l5-5-5-5" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    {/* Step: Amount + confirm */}
    {!loading&&step==="amount"&&selOp&&(
      <div>
        <button onClick={()=>setStep("operator")} style={{background:"none",border:"none",color:"#6b7fa3",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:14,padding:0}}>← Back</button>
        <div style={{background:"rgba(0,229,255,0.06)",border:"1px solid rgba(0,229,255,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:18}}>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,marginBottom:2}}>SELECTED OPERATOR</div>
          <div style={{fontWeight:700,color:"#e8edf7",fontSize:15}}>{selOp.name} · {selCountry.name}</div>
          {selOp.minAmount&&<div style={{fontSize:12,color:"#6b7fa3",marginTop:3}}>Range: {selOp.senderCurrencySymbol||"$"}{selOp.minAmount} – {selOp.senderCurrencySymbol||"$"}{selOp.maxAmount}</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:7}}>RECIPIENT PHONE NUMBER *</div>
            <input style={inputS} type="tel" placeholder="e.g. +1234567890 or 0241234567"
              value={phone} onChange={e=>setPhone(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#00e5ff"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
          </div>
          <div>
            <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:7}}>AMOUNT ({selOp.senderCurrencySymbol||"GHS"}) *</div>
            <input style={inputS} type="number" min={selOp.minAmount||1} max={selOp.maxAmount||500} placeholder={"e.g. "+(selOp.minAmount||5)}
              value={amount} onChange={e=>setAmount(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#00e5ff"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
          </div>
          <button onClick={handleBuy} disabled={busy}
            style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#00e5ff,#7b61ff)",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
            {busy?<><span className="spinner"/>Processing…</>:"📞 Send Airtime via Paystack"}
          </button>
        </div>
      </div>
    )}
  </div>
  );
}

/* ── Reloadly: Gift Cards Tab ── */
function ReloadlyGiftCardsTab({reseller, launchPaystack, showToast, recordReloadlyOrder}){
  /* ── state ── */
  const [allCards,   setAllCards]   = useState([]);   // all fetched cards across pages
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage,   setCurrentPage]   = useState(1);
  const [totalPages,    setTotalPages]     = useState(1);
  const PAGE_SIZE = 50;

  /* filter state */
  const [search,      setSearch]      = useState("");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [countries,   setCountries]   = useState([]); // populated from fetched cards

  /* purchase state */
  const [selCard,    setSelCard]    = useState(null);
  const [quantity,   setQuantity]   = useState(1);
  const [selDenom,   setSelDenom]   = useState(null);
  const [recipEmail, setRecipEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [busy,       setBusy]       = useState(false);

  /* ── Direct Reloadly gift-cards API (bypasses proxy) ── */
  const GC_TOKEN = "eyJraWQiOiI5MTYxZDA4Zi05ODhjLTRiYjItYTI5NS03ODc5NmQ2MzJlM2YiLCJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIzMzIzNCIsImlzcyI6Imh0dHBzOi8vcmVsb2FkbHkuYXV0aDAuY29tLyIsImh0dHBzOi8vcmVsb2FkbHkuY29tL3NhbmRib3giOmZhbHNlLCJodHRwczovL3JlbG9hZGx5LmNvbS9wcmVwYWlkVXNlcklkIjoiMzMyMzQiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJhdWQiOiJodHRwczovL2dpZnRjYXJkcy5yZWxvYWRseS5jb20iLCJuYmYiOjE3ODA4ODk0ODMsImF6cCI6IjMzMjM0Iiwic2NvcGUiOiJkZXZlbG9wZXIiLCJleHAiOjE3ODYwNzM0ODMsImh0dHBzOi8vcmVsb2FkbHkuY29tL2p0aSI6ImJjMWYxNDM0LTI4ZTQtNGMzNy05YjhmLWY1NTc2NDAzZGJjNSIsImlhdCI6MTc4MDg4OTQ4MywianRpIjoiMDVlNGJmNmMtOGJlZi00OTY5LTlkYjQtMTFlMzllOWY4OTRlIn0.XFRpfITRr2rsIHXRj7duieMI8MMkbLx85XrUq82eAqU";
  const GC_BASE = "https://giftcards.reloadly.com";
  const gcFetch = async(path, opts={}) => {
    const res = await fetch(GC_BASE + path, {
      method: opts.method || "GET",
      headers: { "Authorization": `Bearer ${GC_TOKEN}`, "Accept": "application/com.reloadly.giftcards-v1+json", "Content-Type": "application/json" },
      body: opts.body || undefined
    });
    if(!res.ok){ const e = await res.json().catch(()=>({})); throw new Error(e.message||e.errorCode||res.statusText); }
    return res.json();
  };

  const fetchPage = async(p=1) => {
    setLoading(true); setError("");
    try{
      const d = await gcFetch(`/products?page=${p}&size=${PAGE_SIZE}`);
      const items = Array.isArray(d) ? d : (d.content || []);
      setAllCards(items);
      setTotalPages(d.totalPages || 1);
      setTotalElements(d.totalElements || items.length);
      setCurrentPage(p);
      const ctrySet = [...new Set(items.map(c=>c.country?.name||"").filter(Boolean))].sort();
      setCountries(ctrySet);
    }catch(e){
      setError("Could not load gift cards: "+e.message);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ fetchPage(1); },[]);

  /* ── derived filtered list ── */
  const filtered = allCards.filter(c=>{
    const name  = (c.productName||"").toLowerCase();
    const brand = (c.brand?.brandName||"").toLowerCase();
    const ctry  = c.country?.name||"";
    const s     = search.toLowerCase();
    return (name.includes(s)||brand.includes(s)) && (countryFilter==="ALL"||ctry===countryFilter);
  });

  /* ── buy handler ── */
  const handleBuy = () => {
    if(!recipEmail.trim()){ showToast("Enter recipient email","error"); return; }
    if(!selDenom){ showToast("Select a denomination","error"); return; }
    const total = selDenom * quantity;
    setBusy(true);
    launchPaystack(total, async(ref)=>{
      try{
        await gcFetch("/orders",{
          method:"POST",
          body:JSON.stringify({productId:selCard.productId,quantity,unitPrice:selDenom,
            senderName:senderName||reseller.store_name,recipientEmail:recipEmail})
        });
        await recordReloadlyOrder({type:"giftcard",
          label:`${selCard.productName} x${quantity} @${selCard.recipientCurrencyCode||selCard.denominationCurrencyCode}${selDenom}`,
          amount:total,phone:recipEmail,ref});
        showToast("✅ Gift card order placed!");
        setSelCard(null); setSelDenom(null); setQuantity(1); setRecipEmail(""); setSenderName("");
      }catch(e){ showToast("Gift card failed: "+e.message,"error"); }
      finally{ setBusy(false); }
    });
  };

  const inputS = {width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",
    border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",
    fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};

  /* ── helpers ── */
  const getFixedDenoms = c => c.fixedSenderDenominations || c.fixedRecipientDenominations || c.denominations || [];
  const getCurrency    = c => c.senderCurrencyCode || c.denominationCurrencyCode || c.recipientCurrencyCode || "";
  const getLogo        = c => c.logoUrls?.[0] || c.brand?.logoUrls?.[0] || c.imageUrl || null;

  /* ── PURCHASE VIEW ── */
  if(selCard){
    const denoms   = getFixedDenoms(selCard);
    const currency = getCurrency(selCard);
    const logo     = getLogo(selCard);
    const minV = selCard.minSenderDenomination ?? selCard.minDenomination;
    const maxV = selCard.maxSenderDenomination ?? selCard.maxDenomination;
    return(
    <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
      <button onClick={()=>setSelCard(null)}
        style={{background:"none",border:"none",color:"#6b7fa3",cursor:"pointer",
          fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:14,padding:0,
          display:"flex",alignItems:"center",gap:6}}>
        ← Back to cards
      </button>

      {/* Card hero */}
      <div style={{background:"rgba(123,97,255,0.08)",border:"1px solid rgba(123,97,255,0.3)",
        borderRadius:18,padding:"18px 20px",marginBottom:20,display:"flex",gap:16,alignItems:"center"}}>
        {logo
          ? <img src={logo} alt={selCard.productName}
              style={{width:80,height:54,objectFit:"contain",borderRadius:10,background:"#fff",padding:4,flexShrink:0}}/>
          : <div style={{width:80,height:54,background:"rgba(123,97,255,0.2)",borderRadius:10,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0}}>🎁</div>
        }
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,color:"#e8edf7",fontSize:15,lineHeight:1.3,marginBottom:4}}>
            {selCard.productName}
          </div>
          <div style={{fontSize:12,color:"#7b61ff"}}>{selCard.brand?.brandName||""}</div>
          <div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>
            {selCard.country?.name||selCard.countryCode||""} · {currency}
          </div>
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {/* Fixed denominations */}
        {denoms.length>0&&(
          <div>
            <div style={{fontSize:11,color:"#6b7fa3",fontWeight:700,letterSpacing:0.5,marginBottom:10}}>
              SELECT AMOUNT ({currency})
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {denoms.map(d=>(
                <button key={d} onClick={()=>setSelDenom(d)}
                  style={{padding:"9px 18px",borderRadius:10,cursor:"pointer",
                    border:`1.5px solid ${selDenom===d?"#7b61ff":"rgba(255,255,255,0.12)"}`,
                    background:selDenom===d?"rgba(123,97,255,0.22)":"transparent",
                    color:selDenom===d?"#c4b5fd":"#6b7fa3",
                    fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,transition:"all .2s"}}>
                  {currency} {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Range input */}
        {denoms.length===0&&(minV!=null||maxV!=null)&&(
          <div>
            <div style={{fontSize:11,color:"#6b7fa3",fontWeight:700,letterSpacing:0.5,marginBottom:8}}>
              AMOUNT ({currency}) · Range: {minV} – {maxV}
            </div>
            <input style={inputS} type="number" min={minV||1} max={maxV||9999} step="1"
              placeholder={`Enter amount (${currency})`}
              value={selDenom||""}
              onChange={e=>setSelDenom(parseFloat(e.target.value)||null)}
              onFocus={e=>e.target.style.borderColor="#7b61ff"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
          </div>
        )}

        {/* Quantity */}
        <div>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:700,letterSpacing:0.5,marginBottom:8}}>QUANTITY</div>
          <input style={{...inputS,width:"auto",maxWidth:120}} type="number" min="1" max="10"
            value={quantity} onChange={e=>setQuantity(Math.max(1,parseInt(e.target.value)||1))}
            onFocus={e=>e.target.style.borderColor="#7b61ff"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
        </div>

        {/* Recipient email */}
        <div>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:700,letterSpacing:0.5,marginBottom:8}}>
            RECIPIENT EMAIL *
          </div>
          <input style={inputS} type="email" placeholder="customer@email.com"
            value={recipEmail} onChange={e=>setRecipEmail(e.target.value)}
            onFocus={e=>e.target.style.borderColor="#7b61ff"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
        </div>

        {/* Sender name */}
        <div>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:700,letterSpacing:0.5,marginBottom:8}}>
            SENDER NAME (optional)
          </div>
          <input style={inputS} type="text" placeholder="From…"
            value={senderName} onChange={e=>setSenderName(e.target.value)}
            onFocus={e=>e.target.style.borderColor="#7b61ff"}
            onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
        </div>

        {/* Total */}
        {selDenom&&(
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,
            padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",
            border:"1px solid rgba(255,255,255,0.08)"}}>
            <div>
              <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,marginBottom:2}}>TOTAL (GHS equiv.)</div>
              <div style={{fontSize:11,color:"#6b7fa3"}}>{quantity} × {currency} {selDenom}</div>
            </div>
            <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#00d68f"}}>
              GHS {(selDenom*quantity).toFixed(2)}
            </span>
          </div>
        )}

        <button onClick={handleBuy} disabled={busy||!selDenom}
          style={{width:"100%",padding:"15px",borderRadius:14,border:"none",
            background:"linear-gradient(135deg,#7b61ff,#00e5ff)",color:"#fff",fontWeight:800,
            fontSize:16,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            opacity:(!selDenom||busy)?0.55:1,transition:"opacity .2s"}}>
          {busy?<><span className="spinner"/>Processing…</>:"🎁 Buy Gift Card via Paystack"}
        </button>
      </div>
    </div>
    );
  }

  /* ── BROWSE VIEW ── */
  return(
  <div style={{padding:"0 16px 40px"}}>
    {/* Header */}
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4,
        display:"flex",alignItems:"center",gap:10}}>
        🎁 Gift Cards
        {totalElements>0&&(
          <span style={{fontSize:11,color:"#7b61ff",background:"rgba(123,97,255,0.15)",
            border:"1px solid rgba(123,97,255,0.3)",borderRadius:20,padding:"3px 10px",fontWeight:700}}>
            {totalElements.toLocaleString()} TOTAL
          </span>
        )}
      </div>
      <div style={{color:"#6b7fa3",fontSize:13}}>Buy digital gift cards delivered instantly by email.</div>
    </div>

    {/* Search + filter row */}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <input value={search} onChange={e=>setSearch(e.target.value)}
        style={{...inputS,flex:1,minWidth:140,fontSize:13,padding:"9px 12px"}}
        placeholder="Search product or brand…"
        onFocus={e=>e.target.style.borderColor="#7b61ff"}
        onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
      {countries.length>0&&(
        <select value={countryFilter} onChange={e=>setCountryFilter(e.target.value)}
          style={{...inputS,width:"auto",padding:"9px 12px",fontSize:13,flex:"0 0 auto",appearance:"none",cursor:"pointer"}}>
          <option value="ALL">All Countries</option>
          {countries.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>

    {/* Error */}
    {error&&(
      <div style={{background:"rgba(255,77,109,0.1)",border:"1px solid rgba(255,77,109,0.3)",
        borderRadius:12,padding:"12px 16px",color:"#ff4d6d",fontSize:13,marginBottom:16}}>
        ⚠ {error}
        <button onClick={()=>fetchPage(1)}
          style={{marginLeft:12,background:"none",border:"none",color:"#ff4d6d",cursor:"pointer",
            fontWeight:700,fontSize:13,fontFamily:"'DM Sans',sans-serif",textDecoration:"underline"}}>
          Retry
        </button>
      </div>
    )}

    {/* Loading */}
    {loading&&(
      <div style={{textAlign:"center",padding:"52px 16px",color:"#6b7fa3",fontSize:13,letterSpacing:0.5}}>
        <span className="spinner" style={{width:28,height:28,borderTopColor:"#7b61ff",display:"inline-block",verticalAlign:"middle",marginRight:10}}/>
        Loading gift cards…
      </div>
    )}

    {/* Grid */}
    {!loading&&!error&&(
      <>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8,marginBottom:16}}>
          {filtered.map(c=>{
            const logo   = getLogo(c);
            const denoms = getFixedDenoms(c);
            const cur    = getCurrency(c);
            const minV   = c.minSenderDenomination ?? c.minDenomination;
            const maxV   = c.maxSenderDenomination ?? c.maxDenomination;
            return(
              <div key={c.productId}
                onClick={()=>{ setSelCard(c); setSelDenom(denoms[0]||null); setQuantity(1); }}
                style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",
                  borderRadius:12,padding:"12px",display:"flex",flexDirection:"column",gap:7,
                  cursor:"pointer",transition:"border-color .2s,transform .2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(123,97,255,0.55)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";e.currentTarget.style.transform="translateY(0)";}}>

                {/* Logo / icon */}
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  {logo
                    ? <img src={logo} alt={c.productName}
                        style={{width:36,height:36,objectFit:"contain",background:"#fff",
                          borderRadius:6,padding:2,flexShrink:0}}/>
                    : <div style={{width:36,height:36,background:"rgba(123,97,255,0.15)",borderRadius:6,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🎁</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:11,color:"#e6edf3",lineHeight:1.35,
                      overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                      {c.productName}
                    </div>
                    {c.brand?.brandName&&(
                      <div style={{fontSize:10,color:"#6b7fa3",marginTop:1}}>{c.brand.brandName}</div>
                    )}
                    {c.country?.name&&(
                      <div style={{fontSize:9,color:"#4b5568",marginTop:1}}>{c.country.name}</div>
                    )}
                  </div>
                </div>

                {/* Denominations preview */}
                {denoms.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    {denoms.slice(0,4).map(d=>(
                      <span key={d} style={{fontSize:9,background:"rgba(10,10,15,0.6)",
                        border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,
                        padding:"1px 5px",color:"#3fb950"}}>
                        {cur} {d}
                      </span>
                    ))}
                    {denoms.length>4&&(
                      <span style={{fontSize:9,color:"#6b7fa3"}}>+{denoms.length-4}</span>
                    )}
                  </div>
                )}
                {denoms.length===0&&(minV!=null||maxV!=null)&&(
                  <div style={{fontSize:9,color:"#3fb950"}}>
                    {cur} {minV} – {maxV}
                  </div>
                )}

                {/* Product ID */}
                {c.productId&&(
                  <div style={{fontSize:9,color:"#4b5568"}}>ID: {c.productId}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filtered.length===0&&!loading&&(
          <div style={{textAlign:"center",padding:"40px 20px",color:"#6b7fa3"}}>
            <div style={{fontSize:36,marginBottom:10}}>🔍</div>
            <div>No gift cards match your search.</div>
          </div>
        )}

        {/* Pagination */}
        {totalPages>1&&(
          <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,paddingTop:8}}>
            <button onClick={()=>fetchPage(currentPage-1)} disabled={currentPage<=1||loading}
              style={{padding:"8px 18px",borderRadius:9,background:"rgba(123,97,255,0.15)",
                border:"1px solid rgba(123,97,255,0.3)",color:currentPage<=1?"#4b5568":"#c4b5fd",
                fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,
                cursor:currentPage<=1?"not-allowed":"pointer",transition:"all .2s"}}>
              ← Prev
            </button>
            <span style={{fontSize:12,color:"#6b7fa3",fontWeight:500}}>
              Page {currentPage} of {totalPages}
            </span>
            <button onClick={()=>fetchPage(currentPage+1)} disabled={currentPage>=totalPages||loading}
              style={{padding:"8px 18px",borderRadius:9,background:"rgba(123,97,255,0.15)",
                border:"1px solid rgba(123,97,255,0.3)",color:currentPage>=totalPages?"#4b5568":"#c4b5fd",
                fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,
                cursor:currentPage>=totalPages?"not-allowed":"pointer",transition:"all .2s"}}>
              Next →
            </button>
          </div>
        )}
      </>
    )}
  </div>
  );
}

/* ── Reloadly: eSIM Tab ── */
function ReloadlyESIMTab({reseller, launchPaystack, showToast, recordReloadlyOrder}){
  const [packages,   setPackages]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [email,      setEmail]      = useState("");
  const [selPkg,     setSelPkg]     = useState(null);
  const [search,     setSearch]     = useState("");

  useEffect(()=>{
    setLoading(true);
    rlFetch("esim","/esims/packages?size=50",{headers:{"Accept":"application/com.reloadly.esim-v1+json"}})
      .then(d=>setPackages(Array.isArray(d)?d:d.content||[]))
      .catch(e=>showToast("Could not load eSIM packages: "+e.message,"error"))
      .finally(()=>setLoading(false));
  },[]);

  const filtered = packages.filter(p=>{
    const s = search.toLowerCase();
    return !s||(p.name||"").toLowerCase().includes(s)||(p.description||"").toLowerCase().includes(s);
  });

  const handleBuy = ()=>{
    if(!email.trim()){ showToast("Enter your email to receive the eSIM","error"); return; }
    if(!selPkg){ showToast("Select an eSIM package","error"); return; }
    const amt = parseFloat(selPkg.price||0);
    setBusy(true);
    launchPaystack(amt, async(ref)=>{
      try{
        await rlFetch("esim","/esims",{
          method:"POST",
          headers:{"Accept":"application/com.reloadly.esim-v1+json"},
          body:JSON.stringify({packageId:selPkg.packageId,email})
        });
        await recordReloadlyOrder({type:"esim",label:`eSIM: ${selPkg.name}`,amount:amt,phone:email,ref});
        showToast("✅ eSIM ordered! Check your email.");
        setSelPkg(null); setEmail("");
      }catch(e){ showToast("eSIM failed: "+e.message,"error"); }
      finally{ setBusy(false); }
    });
  };

  const inputS = {width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};

  return(
  <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4}}>📶 eSIM</div>
    <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Travel data eSIMs delivered to your email instantly.</div>

    <input value={search} onChange={e=>setSearch(e.target.value)}
      style={{...inputS,marginBottom:16}}
      placeholder="Search by country or region…"
      onFocus={e=>e.target.style.borderColor="#00e5ff"}
      onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>

    {loading?<div style={{textAlign:"center",padding:"40px"}}><span className="spinner" style={{width:32,height:32,borderTopColor:"#00e5ff"}}/></div>:(
      <>
        {!selPkg&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:400,overflowY:"auto"}}>
            {filtered.slice(0,40).map(p=>(
              <div key={p.packageId||p.id} onClick={()=>setSelPkg(p)}
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",cursor:"pointer",transition:"all .2s",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,229,255,0.4)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
                <div>
                  <div style={{fontWeight:700,color:"#e8edf7",fontSize:14}}>{p.name||p.description}</div>
                  <div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>{p.data||""} {p.duration?"· "+p.duration+" days":""} {p.countries?.length?"· "+p.countries.length+" countries":""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:"#00e5ff"}}>GHS {parseFloat(p.price||0).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {filtered.length===0&&<div style={{color:"#6b7fa3",textAlign:"center",padding:"32px"}}>No packages found.</div>}
          </div>
        )}

        {selPkg&&(
          <div>
            <button onClick={()=>setSelPkg(null)} style={{background:"none",border:"none",color:"#6b7fa3",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:14,padding:0}}>← Back to packages</button>
            <div style={{background:"rgba(0,229,255,0.06)",border:"1px solid rgba(0,229,255,0.2)",borderRadius:16,padding:"16px",marginBottom:18}}>
              <div style={{fontWeight:700,color:"#e8edf7",fontSize:16,marginBottom:6}}>{selPkg.name||selPkg.description}</div>
              {selPkg.data&&<div style={{fontSize:13,color:"#6b7fa3",marginBottom:3}}>📊 Data: {selPkg.data}</div>}
              {selPkg.duration&&<div style={{fontSize:13,color:"#6b7fa3",marginBottom:3}}>⏱️ Valid: {selPkg.duration} days</div>}
              {selPkg.countries?.length&&<div style={{fontSize:13,color:"#6b7fa3"}}>🌍 {selPkg.countries.length} countries</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:7}}>YOUR EMAIL (eSIM sent here) *</div>
                <input style={inputS} type="email" placeholder="you@email.com" value={email} onChange={e=>setEmail(e.target.value)}
                  onFocus={e=>e.target.style.borderColor="#00e5ff"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
              </div>
              <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between"}}>
                <span style={{color:"#6b7fa3"}}>Total</span>
                <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:"#00d68f"}}>GHS {parseFloat(selPkg.price||0).toFixed(2)}</span>
              </div>
              <button onClick={handleBuy} disabled={busy}
                style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#00e5ff,#7b61ff)",color:"#fff",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                {busy?<><span className="spinner"/>Processing…</>:"📶 Buy eSIM via Paystack"}
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
  );
}

/* ── Reloadly: Subscriptions Tab ── */
function ReloadlySubscriptionsTab({reseller, launchPaystack, showToast, recordReloadlyOrder}){
  const [plans,     setPlans]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [selPlan,   setSelPlan]   = useState(null);
  const [accNumber, setAccNumber] = useState("");
  const [email,     setEmail]     = useState("");
  const [search,    setSearch]    = useState("");

  useEffect(()=>{
    setLoading(true);
    // Utilities API: bill payments / subscriptions
    rlFetch("subscriptions","/utilities/billers?size=60&type=MOBILE_MONEY",{headers:{"Accept":"application/com.reloadly.utilities-v1+json"}})
      .then(d=>setPlans(Array.isArray(d)?d:d.content||[]))
      .catch(()=>{
        return rlFetch("subscriptions","/utilities/billers?size=60",{headers:{"Accept":"application/com.reloadly.utilities-v1+json"}})
          .then(d=>setPlans(Array.isArray(d)?d:d.content||[]));
      })
      .catch(e=>showToast("Could not load subscriptions: "+e.message,"error"))
      .finally(()=>setLoading(false));
  },[]);

  const filtered = plans.filter(p=>{
    const s = search.toLowerCase();
    return !s||(p.name||"").toLowerCase().includes(s)||(p.countryCode||"").toLowerCase().includes(s);
  });

  const handleBuy = ()=>{
    if(!accNumber.trim()){ showToast("Enter account/subscriber number","error"); return; }
    if(!selPlan){ showToast("Select a plan","error"); return; }
    const amt = parseFloat(selPlan.localTransactionCurrencyCode==="GHS"?(selPlan.minLocalTransactionAmount||5):5);
    setBusy(true);
    launchPaystack(amt, async(ref)=>{
      try{
        await rlFetch("subscriptions","/utilities/payments",{
          method:"POST",
          headers:{"Accept":"application/com.reloadly.utilities-v1+json"},
          body:JSON.stringify({billerId:selPlan.id,subscriberAccountNumber:accNumber,amount:amt,useLocalAmount:true})
        });
        await recordReloadlyOrder({type:"subscription",label:`${selPlan.name} subscription`,amount:amt,phone:accNumber,ref});
        showToast("✅ Subscription payment sent!");
        setSelPlan(null); setAccNumber(""); setEmail("");
      }catch(e){ showToast("Payment failed: "+e.message,"error"); }
      finally{ setBusy(false); }
    });
  };

  const inputS = {width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};

  return(
  <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4}}>📺 Subscriptions</div>
    <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Pay bills and subscriptions — TV, utilities, and more.</div>

    <input value={search} onChange={e=>setSearch(e.target.value)}
      style={{...inputS,marginBottom:16}}
      placeholder="Search services…"
      onFocus={e=>e.target.style.borderColor="#ffd166"}
      onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>

    {loading?<div style={{textAlign:"center",padding:"40px"}}><span className="spinner" style={{width:32,height:32,borderTopColor:"#ffd166"}}/></div>:(
      <>
        {!selPlan&&(
          <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:420,overflowY:"auto"}}>
            {filtered.slice(0,60).map(p=>(
              <div key={p.id} onClick={()=>setSelPlan(p)}
                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 16px",cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(255,209,102,0.5)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
                <div>
                  <div style={{fontWeight:700,color:"#e8edf7",fontSize:14}}>{p.name}</div>
                  <div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>{p.countryCode||""} {p.type||""}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M7 15l5-5-5-5" stroke="#ffd166" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            ))}
            {filtered.length===0&&<div style={{color:"#6b7fa3",textAlign:"center",padding:"32px"}}>No services found.</div>}
          </div>
        )}

        {selPlan&&(
          <div>
            <button onClick={()=>setSelPlan(null)} style={{background:"none",border:"none",color:"#6b7fa3",cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:14,padding:0}}>← Back</button>
            <div style={{background:"rgba(255,209,102,0.06)",border:"1px solid rgba(255,209,102,0.25)",borderRadius:16,padding:"14px 16px",marginBottom:18}}>
              <div style={{fontWeight:700,color:"#e8edf7",fontSize:15}}>{selPlan.name}</div>
              {selPlan.countryCode&&<div style={{fontSize:12,color:"#6b7fa3",marginTop:2}}>{selPlan.countryCode} · {selPlan.type||"Bill Payment"}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:7}}>ACCOUNT / SUBSCRIBER NUMBER *</div>
                <input style={inputS} type="text" placeholder="Your account number" value={accNumber} onChange={e=>setAccNumber(e.target.value)}
                  onFocus={e=>e.target.style.borderColor="#ffd166"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
              </div>
              {selPlan.minLocalTransactionAmount&&(
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:"#6b7fa3",fontSize:13}}>Min / Max</span>
                  <span style={{color:"#ffd166",fontWeight:600,fontSize:13}}>{selPlan.localTransactionCurrencyCode||"GHS"} {selPlan.minLocalTransactionAmount} – {selPlan.maxLocalTransactionAmount}</span>
                </div>
              )}
              <button onClick={handleBuy} disabled={busy}
                style={{width:"100%",padding:"15px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#ffd166,#ff9a3c)",color:"#000",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                {busy?<><span className="spinner" style={{borderTopColor:"#000"}}/>Processing…</>:"📺 Pay via Paystack"}
              </button>
            </div>
          </div>
        )}
      </>
    )}
  </div>
  );
}

/* ── StoreFront (customer-facing purchase page) ── */
function StoreFront({slug}){
  const [reseller,  setReseller]  = useState(null);
  const [notFound,  setNotFound]  = useState(false);
  const [network,   setNetwork]   = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [phone,     setPhone]     = useState("");
  const [email,     setEmail]     = useState("");
  const [buying,    setBuying]    = useState(false);
  const [done,      setDone]      = useState(null);
  const [toast,     setToast]     = useState({msg:"",type:""});
  const [resellerPrices, setResellerPrices] = useState({});

  const PAYSTACK_PK = "pk_live_d093131f6a1823be2cf892e9378027de29ddc7b1";

  const showToast=(msg,type="success")=>{
    setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:""}),3500);
  };

  useEffect(()=>{
    sb("resellers?store_slug=eq."+slug+"&select=*")
      .then(r=>{
        if(r&&r.length){
          setReseller(r[0]);
          return sb("reseller_prices?reseller_id=eq."+r[0].id+"&select=bundle_id,price");
        } else { setNotFound(true); return []; }
      })
      .then(prices=>{
        if(prices&&prices.length){
          const map = {};
          prices.forEach(p=>{ map[p.bundle_id]=parseFloat(p.price); });
          setResellerPrices(map);
        }
      })
      .catch(()=>setNotFound(true));
  },[slug]);

  const getPrice = (b) => resellerPrices[b.id] || b.base;

  const NET_META = {
    MTN:       { color:"#FFCD00", glow:"rgba(255,205,0,0.35)", dark:"#1a1400", label:"MTN", grad:"linear-gradient(135deg,#FFCD00,#FF9500)" },
    AirtelTigo:{ color:"#FF3B30", glow:"rgba(255,59,48,0.35)",  dark:"#1a0000", label:"AirtelTigo", grad:"linear-gradient(135deg,#FF3B30,#FF6B00)" },
    Telecel:   { color:"#007AFF", glow:"rgba(0,122,255,0.35)",  dark:"#00091a", label:"Telecel", grad:"linear-gradient(135deg,#007AFF,#5856D6)" },
  };

  const NET_LOGO = {
    MTN: <div style={{width:58,height:58,background:"linear-gradient(135deg,#FFCD00,#FF9500)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:14,color:"#000",fontFamily:"sans-serif",letterSpacing:-0.5,boxShadow:"0 4px 20px rgba(255,205,0,0.4)"}}>MTN</div>,
    AirtelTigo: <div style={{width:58,height:58,background:"linear-gradient(135deg,#FF3B30,#FF6B00)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:10,fontFamily:"sans-serif",textAlign:"center",lineHeight:1.2,boxShadow:"0 4px 20px rgba(255,59,48,0.4)"}}>airtel<br/>tigo</div>,
    Telecel: <div style={{width:58,height:58,background:"linear-gradient(135deg,#007AFF,#5856D6)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:18,fontFamily:"sans-serif",boxShadow:"0 4px 20px rgba(0,122,255,0.4)"}}>t</div>,
  };

  const [sfTab, setSfTab] = useState("bundles"); // "bundles"|"giftcards"|"esim"|"utilities"|"social"|"track"
  const [socialSelected, setSocialSelected] = useState(null);
  const [socialQty, setSocialQty] = useState(1000);
  const [socialLink, setSocialLink] = useState("");
  const [socialUsername, setSocialUsername] = useState("");
  const [socialNote, setSocialNote] = useState("");
  const [socialCat, setSocialCat] = useState("Instagram");
  const [socialDone, setSocialDone] = useState(null);

  const recordOrder = async(paystackRef)=>{
    const amount = getPrice(selected);
    const bundleStr = selected.label+" - GHS"+amount.toFixed(2);
    const orderId = genOrderId();
    try{
      await sb("resellers?id=eq."+reseller.id,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({wallet_balance:(reseller.wallet_balance||0),total_sales:(reseller.total_sales||0)+amount,total_customers:(reseller.total_customers||0)+1})});
      await sb("transactions",{method:"POST",prefer:"return=representation",
        body:JSON.stringify({reseller_id:reseller.id,network:network,bundle:bundleStr,amount,customer_phone:phone,customer_email:email||null,status:"pending",type:"data_purchase",payment_ref:paystackRef,order_ref:orderId})});
      setDone({bundle:bundleStr,phone,amount,orderId});
    }catch(e){ showToast("Order recording failed: "+e.message,"error"); }
  };

  const recordSocialOrder = async(paystackRef)=>{
    if(!socialSelected) return;
    const baseP = getSocialBasePrice(socialSelected);
    const unitP = baseP / socialSelected.per;
    const total = parseFloat((unitP * socialQty).toFixed(2));
    const target = socialLink || socialUsername;
    const bundleStr = socialSelected.platform+" — "+socialSelected.name+" x"+socialQty+" | "+target;
    const orderId = genOrderId();
    try{
      await sb("resellers?id=eq."+reseller.id,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({total_sales:(reseller.total_sales||0)+total,total_customers:(reseller.total_customers||0)+1})});
      await sb("transactions",{method:"POST",prefer:"return=representation",
        body:JSON.stringify({reseller_id:reseller.id,network:"Social",bundle:bundleStr,amount:total,customer_phone:target,customer_email:email||null,status:"pending",type:"social_order",payment_ref:paystackRef,order_ref:orderId})});
      setSocialDone({bundle:bundleStr,target,amount:total,orderId});
    }catch(e){ showToast("Order recording failed: "+e.message,"error"); }
  };

  const recordReloadlyOrder = async({type,label,amount,phone,ref})=>{
    const orderId = genOrderId();
    try{
      await sb("resellers?id=eq."+reseller.id,{method:"PATCH",prefer:"return=representation",
        body:JSON.stringify({total_sales:(reseller.total_sales||0)+amount,total_customers:(reseller.total_customers||0)+1})});
      await sb("transactions",{method:"POST",prefer:"return=representation",
        body:JSON.stringify({reseller_id:reseller.id,network:"Reloadly",bundle:label,amount,customer_phone:phone,status:"pending",type,payment_ref:ref,order_ref:orderId})});
    }catch(e){ console.warn("Reloadly order log failed",e); }
  };

  const launchPaystack = (amount, onSuccess, meta={})=>{
    if(!window.PaystackPop){ showToast("Payment system not loaded","error"); return; }
    const ref = "_G"+reseller.store_name.replace(/\s+/g,"").toUpperCase().slice(0,12)+"_"+Date.now();
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PK,
      email: email || "customer@dataresell.pro",
      amount: Math.round(amount * 100),
      currency: "GHS",
      ref,
      metadata: {custom_fields:[{display_name:"Store",variable_name:"store",value:reseller.store_name},...Object.entries(meta).map(([k,v])=>({display_name:k,variable_name:k,value:String(v)}))]},
      callback: (response)=>{ onSuccess(response.reference); },
      onClose: ()=>{ showToast("Payment cancelled","error"); setBuying(false); }
    });
    handler.openIframe();
  };

  const handleBuy = ()=>{
    if(!selected){ showToast("Select a bundle","error"); return; }
    if(!phone.trim()){ showToast("Enter your phone number","error"); return; }
    const amount = getPrice(selected);
    setBuying(true);
    launchPaystack(amount, async(ref)=>{
      await recordOrder(ref);
      setBuying(false);
    });
  };

  const handleSocialBuy = ()=>{
    if(!socialSelected){ showToast("Select a service","error"); return; }
    if(!socialLink.trim()&&!socialUsername.trim()){ showToast("Enter link or username","error"); return; }
    if(!email.trim()){ showToast("Enter your email for receipt","error"); return; }
    const baseP = getSocialBasePrice(socialSelected);
    const unitP = baseP / socialSelected.per;
    const total = parseFloat((unitP * socialQty).toFixed(2));
    setBuying(true);
    launchPaystack(total, async(ref)=>{
      await recordSocialOrder(ref);
      setBuying(false);
    }, {service:socialSelected.name, qty:socialQty, target:socialLink||socialUsername});
  };

  const fmtGHS = n => "GHS "+n.toFixed(2);

  if(notFound) return(
    <div className="sf-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:20}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:64,marginBottom:16}}>🔍</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:24,color:"#e8edf7",marginBottom:10}}>Store Not Found</div>
        <div style={{color:"#6b7fa3",fontSize:15}}>This reseller store doesn't exist or has been removed.</div>
      </div>
    </div>
  );

  if(!reseller) return(
    <div className="sf-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:"3px solid rgba(0,229,255,.3)",borderTopColor:"#00e5ff",borderRadius:"50%",animation:"spin .7s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{color:"#6b7fa3",fontSize:14}}>Loading store…</div>
      </div>
    </div>
  );

  if(done) return(
    <div className="sf-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:20}}>
      <div style={{textAlign:"center",maxWidth:380,width:"100%"}}>
        <div style={{fontSize:72,marginBottom:12,animation:"pulse 1s infinite"}}>✅</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#e8edf7",marginBottom:6}}>Order Placed!</div>
        <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Your data bundle is being processed. Save your Order ID to track progress.</div>

        {/* Order ID box */}
        <div className="order-id-box" style={{marginBottom:20}} onClick={()=>{navigator.clipboard.writeText(done.orderId);showToast("Order ID copied!");}}>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,letterSpacing:0.5,marginBottom:4}}>ORDER ID — tap to copy</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#00e5ff",letterSpacing:1}}>{done.orderId}</div>
          <div style={{fontSize:11,color:"#6b7fa3",marginTop:4}}>📋 Keep this to track your order</div>
        </div>

        <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"18px 20px",marginBottom:20,textAlign:"left"}}>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>BUNDLE</div>
          <div style={{fontWeight:700,color:"#e8edf7",marginBottom:12,fontSize:15}}>{done.bundle}</div>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>RECIPIENT</div>
          <div style={{fontWeight:700,color:"#00e5ff",marginBottom:12}}>{done.phone}</div>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>AMOUNT PAID</div>
          <div style={{fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif",color:"#00d68f"}}>{fmtGHS(done.amount)}</div>
        </div>

        <div style={{display:"flex",gap:10,flexDirection:"column"}}>
          <button onClick={()=>setSfTab("track")}
            style={{background:"rgba(0,229,255,0.12)",border:"1.5px solid rgba(0,229,255,0.4)",borderRadius:12,padding:"12px",color:"#00e5ff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🔍 Track This Order
          </button>
          <button onClick={()=>{setDone(null);setSelected(null);setPhone("");setEmail("");setSfTab("bundles");}}
            style={{background:"linear-gradient(135deg,#00e5ff,#7b61ff)",border:"none",borderRadius:12,padding:"12px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            Order Again
          </button>
        </div>
      </div>
    </div>
  );

  if(socialDone) return(
    <div className="sf-body" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:20}}>
      <div style={{textAlign:"center",maxWidth:380,width:"100%"}}>
        <div style={{fontSize:72,marginBottom:12,animation:"pulse 1s infinite"}}>🎉</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#e8edf7",marginBottom:6}}>Social Order Placed!</div>
        <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Your order is being processed. Delivery usually within minutes to 24h.</div>

        {/* Order ID box */}
        <div className="order-id-box" style={{marginBottom:20}} onClick={()=>{navigator.clipboard.writeText(socialDone.orderId);showToast("Order ID copied!");}}>
          <div style={{fontSize:11,color:"#6b7fa3",fontWeight:600,letterSpacing:0.5,marginBottom:4}}>ORDER ID — tap to copy</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:22,color:"#00e5ff",letterSpacing:1}}>{socialDone.orderId}</div>
          <div style={{fontSize:11,color:"#6b7fa3",marginTop:4}}>📋 Keep this to track your order</div>
        </div>

        <div style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:16,padding:"18px 20px",marginBottom:20,textAlign:"left"}}>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>SERVICE</div>
          <div style={{fontWeight:700,color:"#e8edf7",marginBottom:12,fontSize:14}}>{socialDone.bundle}</div>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>TARGET</div>
          <div style={{fontWeight:700,color:"#E1306C",marginBottom:12}}>{socialDone.target}</div>
          <div style={{color:"#6b7fa3",fontSize:11,fontWeight:600,marginBottom:3,letterSpacing:0.4}}>AMOUNT PAID</div>
          <div style={{fontWeight:800,fontSize:22,fontFamily:"'Syne',sans-serif",color:"#00d68f"}}>{fmtGHS(socialDone.amount)}</div>
        </div>

        <div style={{display:"flex",gap:10,flexDirection:"column"}}>
          <button onClick={()=>setSfTab("track")}
            style={{background:"rgba(0,229,255,0.12)",border:"1.5px solid rgba(0,229,255,0.4)",borderRadius:12,padding:"12px",color:"#00e5ff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            🔍 Track This Order
          </button>
          <button onClick={()=>{setSocialDone(null);setSocialSelected(null);setSocialLink("");setSocialUsername("");setSfTab("social");}}
            style={{background:"linear-gradient(135deg,#E1306C,#7b61ff)",border:"none",borderRadius:12,padding:"12px",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            Order Again
          </button>
        </div>
      </div>
    </div>
  );

  const socialBaseP = socialSelected ? getSocialBasePrice(socialSelected) : 0;
  const socialUnitP = socialSelected ? socialBaseP / socialSelected.per : 0;
  const socialTotal = parseFloat((socialUnitP * socialQty).toFixed(2));

  return(
    <div className="sf-body">
      <Toast msg={toast.msg} type={toast.type}/>

      {/* Store header */}
      <div style={{padding:"24px 20px 0",maxWidth:520,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div style={{width:56,height:56,background:"linear-gradient(135deg,#00e5ff,#7b61ff)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:26,color:"#fff",flexShrink:0,boxShadow:"0 8px 30px rgba(0,229,255,0.3)"}}>
            {reseller.store_name[0].toUpperCase()}
          </div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",lineHeight:1}}>{reseller.store_name}</div>
            <div style={{fontSize:13,color:"#6b7fa3",marginTop:3}}>📞 {reseller.phone_number}</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{overflowX:"auto",paddingBottom:4,marginBottom:24}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:14,padding:4,border:"1px solid rgba(255,255,255,0.08)",minWidth:"max-content",gap:2}}>
            {[["bundles","📦","Bundles"],["giftcards","🎁","Gift Cards"],["esim","📶","eSIM"],["utilities","🔌","Utilities"],["social","📱","Social"],["track","🔍","Track"]].map(([id,icon,label])=>(
              <button key={id} onClick={()=>setSfTab(id)}
                style={{flex:"0 0 auto",padding:"9px 12px",border:"none",borderRadius:10,cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,transition:"all .2s",
                  background:sfTab===id?"linear-gradient(135deg,#00e5ff,#7b61ff)":"transparent",
                  color:sfTab===id?"#fff":"#6b7fa3",whiteSpace:"nowrap"}}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BUNDLES TAB */}
      {sfTab==="bundles"&&(
        <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#e8edf7",marginBottom:4}}>📦 Data Bundles</div>
          <div style={{color:"#6b7fa3",fontSize:14,marginBottom:20}}>Choose your network and buy data instantly.</div>

          {/* Network selector */}
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {Object.keys(NET_META).map(n=>{
              const m=NET_META[n];
              return(
                <button key={n} onClick={()=>{setNetwork(n);setSelected(null);}}
                  style={{flex:1,padding:"10px 8px",borderRadius:12,border:`2px solid ${network===n?m.color:"rgba(255,255,255,0.1)"}`,
                    background:network===n?`${m.color}18`:"rgba(255,255,255,0.04)",
                    color:network===n?m.color:"#6b7fa3",fontWeight:700,fontSize:12,cursor:"pointer",
                    fontFamily:"'DM Sans',sans-serif",transition:"all .2s"}}>
                  {n}
                </button>
              );
            })}
          </div>

          {/* Bundle cards */}
          {network&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:24}}>
              {(BASE_BUNDLES[network]||[]).filter(b=>!b.outOfStock).map(b=>{
                const price=getPrice(b);
                const sel=selected&&selected.id===b.id;
                const m=NET_META[network];
                return(
                  <div key={b.id} className="sf-bundle-card"
                    onClick={()=>setSelected(b)}
                    style={{background:sel?`${m.color}15`:"rgba(255,255,255,0.04)",
                      border:`2px solid ${sel?m.color:"rgba(255,255,255,0.08)"}`,
                      boxShadow:sel?`0 0 20px ${m.glow}`:"none"}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:sel?m.color:"#e8edf7"}}>{b.label}</div>
                      <div style={{fontSize:11,color:"#6b7fa3",marginTop:2}}>30 days</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:16,color:sel?m.color:"#00d68f"}}>GHS {price.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Buy form */}
          {selected&&(
            <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:NET_META[network].color}}>{selected.label} {network}</div>
                  <div style={{fontSize:12,color:"#6b7fa3"}}>Valid 30 days · Instant delivery</div>
                </div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"#00d68f"}}>GHS {getPrice(selected).toFixed(2)}</div>
              </div>
              <div>
                <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:6}}>PHONE NUMBER *</div>
                <input value={phone} onChange={e=>setPhone(e.target.value)}
                  style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}}
                  placeholder="e.g. 0241234567" type="tel"
                  onFocus={e=>e.target.style.borderColor=NET_META[network].color}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
              </div>
              <div>
                <div style={{fontSize:12,color:"#6b7fa3",fontWeight:600,marginBottom:6}}>EMAIL (optional – for receipt)</div>
                <input value={email} onChange={e=>setEmail(e.target.value)}
                  style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1.5px solid rgba(255,255,255,0.12)",borderRadius:12,color:"#e8edf7",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}}
                  placeholder="you@email.com" type="email"
                  onFocus={e=>e.target.style.borderColor="#00e5ff"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
              </div>
              <button onClick={handleBuy} disabled={buying}
                style={{width:"100%",padding:"14px",borderRadius:14,border:"none",
                  background:`linear-gradient(135deg,${NET_META[network].color},${NET_META[network].color}aa)`,
                  color:network==="MTN"?"#000":"#fff",fontWeight:800,fontSize:16,cursor:"pointer",
                  fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:10,
                  opacity:buying?0.7:1}}>
                {buying?<><span className="spinner"/>Processing…</>:<>💳 Pay GHS {getPrice(selected).toFixed(2)}</>}
              </button>
            </div>
          )}

          {!network&&(
            <div style={{textAlign:"center",padding:"40px 20px",color:"#6b7fa3",fontSize:14}}>
              👆 Select a network above to see bundles
            </div>
          )}
        </div>
      )}

      {/* RELOADLY: eSIM TAB */}
      {sfTab==="esim"&&(
        <ReloadlyESIMTab reseller={reseller} launchPaystack={launchPaystack} showToast={showToast} recordReloadlyOrder={recordReloadlyOrder}/>
      )}

      {/* RELOADLY: UTILITIES TAB */}
      {sfTab==="utilities"&&(
        <ReloadlySubscriptionsTab reseller={reseller} launchPaystack={launchPaystack} showToast={showToast} recordReloadlyOrder={recordReloadlyOrder}/>
      )}

      {/* RELOADLY: GIFT CARDS TAB */}
      {sfTab==="giftcards"&&(
        <ReloadlyGiftCardsTab reseller={reseller} launchPaystack={launchPaystack} showToast={showToast} recordReloadlyOrder={recordReloadlyOrder}/>
      )}

      {/* SOCIAL MEDIA TAB */}
      {sfTab==="social"&&(
      <div style={{padding:"0 20px 40px",maxWidth:520,margin:"0 auto"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:"#e8edf7",marginBottom:4}}>Social Media Services</div>
        <div style={{color:"#6b7fa3",fontSize:13,marginBottom:18}}>Boost your Instagram, TikTok & more. Fast delivery.</div>

        {/* Category tabs */}
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          {[["Instagram","📸 Instagram"],["General","🎵 TikTok / General"]].map(([cat,label])=>(
            <button key={cat} onClick={()=>{setSocialCat(cat);setSocialSelected(null);}}
              style={{padding:"7px 16px",borderRadius:20,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,border:`1px solid ${socialCat===cat?"#E1306C":"rgba(255,255,255,0.12)"}`,background:socialCat===cat?"rgba(225,48,108,0.18)":"transparent",color:socialCat===cat?"#E1306C":"#6b7fa3",transition:"all .2s"}}>
              {label}
            </button>
          ))}
        </div>

        {/* Service grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
          {SOCIAL_SERVICES.filter(s=>s.category===socialCat).map(s=>{
            const price = getSocialBasePrice(s);
            const sel = socialSelected&&socialSelected.id===s.id;
            return(
              <div key={s.id} onClick={()=>setSocialSelected(s)}
                style={{background:sel?`${s.color}18`:"rgba(255,255,255,0.04)",border:`1.5px solid ${sel?s.color:"rgba(255,255,255,0.08)"}`,borderRadius:14,padding:"14px 14px",cursor:"pointer",transition:"all .2s"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <span style={{fontSize:20}}>{s.icon}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:20,background:`${s.color}22`,color:s.color}}>/{s.per}</span>
                </div>
                <div style={{fontWeight:600,fontSize:12,color:"#e8edf7",marginBottom:2,lineHeight:1.3}}>{s.name}</div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:14,color:sel?s.color:"#00d68f"}}>
                  GHS {price.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Social order form */}
        {socialSelected&&(
          <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"20px 20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
              <span style={{fontSize:24}}>{socialSelected.icon}</span>
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:"#e8edf7"}}>{socialSelected.name}</div>
                <div style={{fontSize:12,color:"#6b7fa3"}}>{socialSelected.platform}</div>
              </div>
            </div>

            <div>
              <label style={{fontSize:13,fontWeight:600,color:"#6b7fa3",display:"block",marginBottom:7}}>
                {socialSelected.category==="Instagram"?"Instagram Post/Profile Link *":"Link / Profile URL *"}
              </label>
              <input style={{...inputStyle,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#e8edf7"}}
                type="text" placeholder={socialSelected.category==="Instagram"?"https://instagram.com/p/... or profile URL":"URL or @username"}
                value={socialLink} onChange={e=>setSocialLink(e.target.value)}
                onFocus={e=>e.target.style.borderColor="#E1306C"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
            </div>

            <div>
              <label style={{fontSize:13,fontWeight:600,color:"#6b7fa3",display:"block",marginBottom:7}}>
                Username (optional)
              </label>
              <input style={{...inputStyle,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#e8edf7"}}
                type="text" placeholder="@username"
                value={socialUsername} onChange={e=>setSocialUsername(e.target.value)}
                onFocus={e=>e.target.style.borderColor="#E1306C"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
            </div>

            <div>
              <label style={{fontSize:13,fontWeight:600,color:"#6b7fa3",display:"block",marginBottom:7}}>
                Quantity ({socialSelected.unit}) — min 100
              </label>
              <input style={{...inputStyle,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#e8edf7"}}
                type="number" min="100" step="100"
                value={socialQty} onChange={e=>setSocialQty(parseInt(e.target.value)||100)}
                onFocus={e=>e.target.style.borderColor="#E1306C"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
            </div>

            <div>
              <label style={{fontSize:13,fontWeight:600,color:"#6b7fa3",display:"block",marginBottom:7}}>Email (for receipt) *</label>
              <input style={{...inputStyle,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#e8edf7"}}
                type="email" placeholder="your@email.com"
                value={email} onChange={e=>setEmail(e.target.value)}
                onFocus={e=>e.target.style.borderColor="#E1306C"}
                onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.12)"}/>
            </div>

            <div style={{background:"rgba(0,0,0,0.2)",borderRadius:12,padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:"#6b7fa3",fontSize:14}}>Total</span>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:"#00d68f"}}>GHS {socialTotal.toFixed(2)}</span>
            </div>

            <button className="paystack-btn" onClick={handleSocialBuy} disabled={buying}
              style={{background:"linear-gradient(135deg,#E1306C,#7b61ff)",color:"#fff"}}>
              {buying?<><span className="spinner"/>Processing…</>:<>Pay GHS {socialTotal.toFixed(2)} →</>}
            </button>
            <div style={{textAlign:"center",fontSize:12,color:"#6b7fa3"}}>🔒 Secured by Paystack · Fast delivery</div>
          </div>
        )}
      </div>
      )}

      {/* TRACK ORDER TAB */}
      {sfTab==="track"&&(
      <TrackOrder resellerId={reseller.id} storeName={reseller.store_name} prefillId={done?.orderId||socialDone?.orderId||""}/>
      )}
    </div>
  );
}

/* ── Android App Install Popup ── */
function AndroidInstallPopup(){
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(()=>{
    const neverShow = localStorage.getItem("gendata_app_popup_dismissed");
    if(neverShow==="true") return;
    const t = setTimeout(()=>setVisible(true), 1800);
    return()=>clearTimeout(t);
  },[]);

  const handleDontShow = ()=>{
    localStorage.setItem("gendata_app_popup_dismissed","true");
    setDismissed(true);
    setVisible(false);
  };

  const handleClose = ()=>setVisible(false);

  if(!visible || dismissed) return null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)",
      WebkitBackdropFilter:"blur(10px)",zIndex:9998,display:"flex",alignItems:"flex-end",justifyContent:"center",
      padding:"0 0 0 0",animation:"fadeUp .3s ease"}}>
      <div style={{
        width:"100%",maxWidth:480,
        background:"linear-gradient(160deg,#12182e 0%,#0d1220 60%,#0a0f1e 100%)",
        border:"1px solid rgba(0,229,255,0.2)",
        borderRadius:"28px 28px 0 0",
        padding:"8px 0 0",
        boxShadow:"0 -24px 80px rgba(0,0,0,0.7), 0 -1px 0 rgba(0,229,255,0.15)",
        position:"relative",overflow:"hidden"}}>

        {/* Drag handle */}
        <div style={{width:40,height:4,background:"rgba(255,255,255,0.15)",borderRadius:4,margin:"0 auto 20px"}}/>

        {/* Decorative glow */}
        <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",
          width:300,height:150,background:`radial-gradient(ellipse,${G.accent}18 0%,transparent 70%)`,
          pointerEvents:"none"}}/>

        <div style={{padding:"0 24px 28px",position:"relative"}}>
          {/* Close button */}
          <button onClick={handleClose}
            style={{position:"absolute",top:-4,right:24,background:"rgba(255,255,255,0.08)",
              border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,
              width:34,height:34,cursor:"pointer",color:G.muted,fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>

          {/* App icon + title */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
            <div style={{width:64,height:64,borderRadius:18,
              background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:32,boxShadow:`0 0 30px ${G.accent}50`,flexShrink:0}}>📶</div>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,
                background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:2}}>
                GenData GH
              </div>
              <div style={{fontSize:12,color:G.muted}}>Data Resell Platform · Ghana</div>
              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}>
                {"⭐⭐⭐⭐⭐".split("").map((s,i)=><span key={i} style={{fontSize:10,color:G.gold}}>{s}</span>)}
                <span style={{fontSize:10,color:G.muted,marginLeft:2}}>5.0 · 1.2k reviews</span>
              </div>
            </div>
          </div>

          {/* Features list */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20}}>
            {[
              {icon:"⚡",text:"Instant delivery"},
              {icon:"📊",text:"Live dashboard"},
              {icon:"💰",text:"Track earnings"},
              {icon:"🔔",text:"Push notifications"},
            ].map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,
                background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"9px 12px",
                border:"1px solid rgba(255,255,255,0.06)"}}>
                <span style={{fontSize:14}}>{f.icon}</span>
                <span style={{fontSize:12,color:G.text,fontWeight:500}}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Download button */}
          <a href="https://lbflhbogfhtnjjnxjntb.supabase.co/storage/v1/object/public/store-assets/6a252f5930a5c04a5ef163ae.apk" download onClick={()=>handleClose()}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,
              background:`linear-gradient(135deg,${G.accent},${G.accent2})`,
              borderRadius:16,padding:"16px 24px",textDecoration:"none",
              boxShadow:`0 8px 32px ${G.accent}40`,marginBottom:12,
              animation:"glow 2s infinite"}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M17.523 15.341a.75.75 0 01-.523.209H7a.75.75 0 01-.523-1.282l4.97-4.97a.75.75 0 011.06 0l4.97 4.97a.75.75 0 01.046 1.073zM12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
            </svg>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.8)",fontWeight:600,letterSpacing:0.5}}>DOWNLOAD FREE ON</div>
              <div style={{fontSize:17,fontWeight:800,color:"#fff",letterSpacing:0.3}}>Android · APK</div>
            </div>
          </a>

          {/* Don't show again */}
          <button onClick={handleDontShow}
            style={{width:"100%",background:"none",border:"none",color:G.muted,
              fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              fontWeight:500,padding:"4px",letterSpacing:0.2}}>
            Don't show this again
          </button>
        </div>
      </div>
    </div>
  );
}
function App(){
  // Resolve route + session synchronously to avoid blank-screen flash
  const _storeMatch = window.location.pathname.match(/^\/store\/([a-z0-9]+)$/);
  const _savedReseller = (()=>{ try{ const s=sessionStorage.getItem("reseller"); return s?JSON.parse(s):null; }catch{ return null; } })();

  const [page, setPage] = useState(_storeMatch ? {type:"store",slug:_storeMatch[1]} : null);
  const [reseller, setReseller] = useState(_savedReseller);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initTab, setInitTab] = useState("signup");
  const [adminTaps, setAdminTaps] = useState(0);
  const adminTapRef = React.useRef(null);

  const handleSecretTap = () => {
    const newCount = adminTaps + 1;
    setAdminTaps(newCount);
    clearTimeout(adminTapRef.current);
    if(newCount >= 7){ setShowAdmin(true); setAdminTaps(0); return; }
    adminTapRef.current = setTimeout(()=>setAdminTaps(0), 2000);
  };

  const handleLogin = (r)=>{ setReseller(r); sessionStorage.setItem("reseller",JSON.stringify(r)); setShowAuth(false); };
  const handleLogout = ()=>{ setReseller(null); sessionStorage.removeItem("reseller"); };

  if(page&&page.type==="store") return <StoreFront slug={page.slug}/>;
  if(isAdmin) return <AdminPanel onLogout={()=>setIsAdmin(false)}/>;
  if(reseller) return (
    <>
      <AndroidInstallPopup/>
      <Dashboard reseller={reseller} onLogout={handleLogout}/>
    </>
  );

  return(
    <>
      <AndroidInstallPopup/>
      {showAuth&&<AuthModal onSuccess={handleLogin} onClose={()=>setShowAuth(false)} initTab={initTab}/>}
      {showAdmin&&<AdminLoginModal onSuccess={()=>{setIsAdmin(true);setShowAdmin(false);}} onClose={()=>setShowAdmin(false)}/>}
      <Landing
        onSignup={()=>{setInitTab("signup");setShowAuth(true);}}
        onLogin={()=>{setInitTab("login");setShowAuth(true);}}
        onSecretTap={handleSecretTap}
      />
      <div style={{position:"fixed",bottom:16,right:16,zIndex:200}}>
        <button onClick={()=>setShowAdmin(true)}
          style={{background:"transparent",border:"none",borderRadius:10,padding:"8px 14px",
            color:"transparent",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
            userSelect:"none",WebkitUserSelect:"none",outline:"none"}}>
          ·
        </button>
      </div>
    </>
  );
}


ReactDOM.render(<App/>, document.getElementById("root"));
