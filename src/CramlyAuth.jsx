import { useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, LockKeyhole, UserRound } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { Zuzu } from "./brand/Zuzu.jsx";
import "./cramly-auth.css";

export default function CramlyAuth({ locale = "ar", mode = "login", onModeChange, onBack, onContinue }) {
  const ar = locale === "ar";
  const copy = ar ? {
    brand:"رفيقك للمراجعة", title:mode === "login"?"أهلاً بعودتك":"ابدئي رحلتك مع Cramly", sub:mode === "login"?"سجّلي الدخول لمتابعة تقدمك وجدولك.":"أنشئي حساباً مجانياً لتنظيم مراجعتك.", name:"الاسم الذي تفضلينه", email:"البريد الإلكتروني", password:"كلمة المرور", submit:mode === "login"?"تسجيل الدخول":"إنشاء حساب مجاني", change:mode === "login"?"ليس لديك حساب؟ أنشئي واحداً":"لديك حساب؟ سجّلي الدخول", back:"العودة إلى الرئيسية", confirm:"تحققي من بريدك الإلكتروني لتأكيد الحساب، ثم سجّلي الدخول.", error:"تعذر إكمال العملية. تحققي من البيانات وحاولي مجدداً.", unavailable:"التسجيل غير متصل في هذه المعاينة.", passwordHint:"6 أحرف على الأقل", privacy:"بياناتك الدراسية خاصة بحسابك."
  } : {
    brand:"Ton alliée révision", title:mode === "login"?"Ravie de te revoir":"Commence avec Cramly", sub:mode === "login"?"Connecte-toi pour retrouver tes progrès et ton planning.":"Crée un compte gratuit pour organiser tes révisions.", name:"Nom préféré", email:"Adresse e-mail", password:"Mot de passe", submit:mode === "login"?"Se connecter":"Créer un compte gratuit", change:mode === "login"?"Pas encore de compte ? Crée-en un":"Déjà inscrite ? Connecte-toi", back:"Retour à l’accueil", confirm:"Vérifie ton e-mail pour confirmer le compte, puis connecte-toi.", error:"Impossible de continuer. Vérifie tes informations et réessaie.", unavailable:"L’inscription n’est pas connectée dans cet aperçu.", passwordHint:"6 caractères minimum", privacy:"Tes données d’étude restent privées dans ton compte."
  };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    if (!supabase) { setIsError(true); setMessage(copy.unavailable); return; }
    setBusy(true);
    try {
      const result = mode === "register"
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "register" && !result.data.session) { setMessage(copy.confirm); return; }
      if (result.data.user) onContinue(result.data.user);
    } catch (error) {
      setIsError(true);
      setMessage(error?.message || copy.error);
    } finally {
      setBusy(false);
    }
  };

  return <main className="cramly-auth" dir={ar ? "rtl" : "ltr"}>
    <header className="cramly-auth-nav"><button className="cramly-auth-brand" onClick={onBack}><img src="/brand/zuzu-app-icon.svg" alt=""/><span>cramly</span></button><button className="cramly-auth-back" onClick={onBack}><Arrow size={16}/>{copy.back}</button></header>
    <section className="cramly-auth-layout"><div className="cramly-auth-aside"><div className="cramly-auth-illustration"><Zuzu pose="reading" streak={4}/></div><span>{copy.brand}</span><p>{copy.privacy}</p></div>
      <div className="cramly-auth-card"><div className="cramly-auth-card-icon"><img src="/brand/zuzu-app-icon.svg" alt=""/><span>{copy.brand}</span></div><h1>{copy.title}</h1><p>{copy.sub}</p>
        <form onSubmit={submit}>
          {mode === "register"&&<label>{copy.name}<span className="cramly-auth-input"><UserRound size={17}/><input value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" required maxLength={80}/></span></label>}
          <label>{copy.email}<span className="cramly-auth-input"><Mail size={17}/><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required/></span></label>
          <label>{copy.password}<span className="cramly-auth-input"><LockKeyhole size={17}/><input type={showPassword?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete={mode==="register"?"new-password":"current-password"} minLength={6} required/><button type="button" className="cramly-auth-eye" onClick={()=>setShowPassword((show)=>!show)} aria-label={showPassword?(ar?"إخفاء كلمة المرور":"Masquer le mot de passe"):(ar?"إظهار كلمة المرور":"Afficher le mot de passe")}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></span><small>{copy.passwordHint}</small></label>
          {message&&<div className={`cramly-auth-message ${isError?"error":""}`} role={isError?"alert":"status"}>{message}</div>}
          <button className="cramly-auth-submit" type="submit" disabled={busy}>{busy?(ar?"جارٍ التحقق…":"Vérification…"):copy.submit}<Arrow size={17}/></button>
        </form>
        <button className="cramly-auth-switch" onClick={()=>{setMessage("");onModeChange();}}>{copy.change}</button>
      </div>
    </section>
  </main>;
}
