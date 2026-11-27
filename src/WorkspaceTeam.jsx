import { useEffect, useState } from "react";
import { Check, Clipboard, Mail, Shield, UserMinus, Users } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import "./workspace-team.css";

const text = {
  ar: {
    team: "مشاركة الفريق", description: "شارك مساحة المشاريع مع زملائك. الدعوة مرتبطة بالبريد الإلكتروني وتنتهي بعد 7 أيام.",
    email: "البريد الإلكتروني للعضو", role: "الصلاحية", editor: "محرر — إضافة وتعديل سجلات المشاريع", viewer: "مشاهد — قراءة فقط",
    invite: "إنشاء رابط دعوة", copy: "نسخ الرابط", copied: "تم نسخ رابط الدعوة", members: "أعضاء مساحة العمل", owner: "المالك", remove: "إزالة العضو",
    removeConfirm: "إزالة هذا العضو من مساحة العمل؟", signIn: "سجّل الدخول لإدارة أعضاء مساحة العمل.", inviteCreated: "أُنشئ رابط الدعوة لهذا البريد. أرسله إلى صاحبه.",
    loading: "جارٍ تحميل الأعضاء…", empty: "لا يوجد أعضاء آخرون بعد.", emailMismatch: "يجب تسجيل الدخول بالبريد الإلكتروني الذي تلقى الدعوة.",
    migration: "مشاركة الفريق تحتاج إلى تطبيق تحديث قاعدة البيانات أولاً.", genericError: "تعذر إكمال العملية. تحقق من الاتصال وحاول مجددًا.",
    roleViewer: "مشاهد", roleEditor: "محرر", inviteBanner: "تمت دعوتك إلى مساحة عمل. سجّل أو أنشئ حسابًا بالبريد نفسه لقبول الدعوة.",
    switchAccount: "لديك حساب بالفعل؟ سجّل الدخول", switchRegister: "ليس لديك حساب؟ أنشئ حسابًا", accepting: "جارٍ التحقق من الدعوة…",
  },
  fr: {
    team: "Partager avec l’équipe", description: "Partagez l’espace projet. Les invitations sont liées à une adresse e-mail et expirent après 7 jours.",
    email: "E-mail du membre", role: "Rôle", editor: "Éditeur — créer et modifier les données projet", viewer: "Lecteur — consultation uniquement",
    invite: "Créer un lien d’invitation", copy: "Copier le lien", copied: "Lien copié", members: "Membres de l’espace", owner: "Propriétaire", remove: "Retirer le membre",
    removeConfirm: "Retirer ce membre de l’espace ?", signIn: "Connectez-vous pour gérer les membres.", inviteCreated: "Lien créé pour cette adresse. Envoyez-le à la personne invitée.",
    loading: "Chargement des membres…", empty: "Aucun autre membre pour le moment.", emailMismatch: "Connectez-vous avec l’adresse e-mail invitée.",
    migration: "Le partage d’équipe nécessite d’abord la mise à jour de la base de données.", genericError: "Action impossible. Vérifiez la connexion puis réessayez.",
    roleViewer: "Lecteur", roleEditor: "Éditeur", inviteBanner: "Vous avez reçu une invitation à un espace. Inscrivez-vous ou connectez-vous avec la même adresse e-mail.",
    switchAccount: "Vous avez déjà un compte ? Connexion", switchRegister: "Pas encore de compte ? Inscription", accepting: "Vérification de l’invitation…",
  },
  en: {
    team: "Share with your team", description: "Share this project workspace. Invitations are tied to an email address and expire after 7 days.",
    email: "Member email", role: "Role", editor: "Editor — create and update project records", viewer: "Viewer — read-only access",
    invite: "Create invitation link", copy: "Copy link", copied: "Invitation link copied", members: "Workspace members", owner: "Owner", remove: "Remove member",
    removeConfirm: "Remove this member from the workspace?", signIn: "Sign in to manage workspace members.", inviteCreated: "Invitation link created for this email. Send it to the invitee.",
    loading: "Loading members…", empty: "No other members yet.", emailMismatch: "Sign in with the email address that received the invitation.",
    migration: "Team sharing requires the database migration to be applied first.", genericError: "Could not complete the action. Check your connection and try again.",
    roleViewer: "Viewer", roleEditor: "Editor", inviteBanner: "You’ve been invited to a workspace. Sign up or sign in using the invited email address.",
    switchAccount: "Already have an account? Sign in", switchRegister: "New here? Create an account", accepting: "Checking invitation…",
  },
};

function errorText(error, t) {
  const message = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();
  if (/function|schema cache|does not exist|pgrst202|42883/.test(message)) return t.migration;
  if (/invalid.*email|belongs to another email|email/.test(message)) return t.emailMismatch;
  return t.genericError;
}

export function WorkspaceTeam({ workspaceId, user, locale, onLogin }) {
  const t = text[locale] || text.en;
  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const owner = members.some((member) => member.user_id === user?.id && member.role === "owner");

  useEffect(() => {
    if (!user || !workspaceId || !supabase) return;
    let active = true;
    setLoading(true);
    supabase.rpc("list_workspace_members", { p_workspace_id: workspaceId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setMessage(errorText(error, t));
        else setMembers(data || []);
      })
      .catch(() => { if (active) setMessage(t.genericError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, workspaceId, locale]);

  const createInvite = async (event) => {
    event.preventDefault();
    if (!workspaceId || !email.trim() || !supabase) return;
    setBusy(true); setMessage(""); setInviteUrl(""); setCopied(false);
    try {
      const { data: token, error } = await supabase.rpc("create_workspace_invite", {
        p_workspace_id: workspaceId, p_email: email.trim(), p_role: role,
      });
      if (error) { setMessage(errorText(error, t)); return; }
      const url = new URL(window.location.href);
      url.search = ""; url.hash = ""; url.searchParams.set("invite", token);
      setInviteUrl(url.toString()); setEmail(""); setMessage(t.inviteCreated);
    } catch { setMessage(t.genericError); }
    finally { setBusy(false); }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true); setMessage(t.copied);
    } catch {
      setMessage(inviteUrl);
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(t.removeConfirm)) return;
    setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("remove_workspace_member", {
        p_workspace_id: workspaceId, p_user_id: member.user_id,
      });
      if (error) { setMessage(errorText(error, t)); return; }
      setMembers((items) => items.filter((item) => item.user_id !== member.user_id));
    } catch { setMessage(t.genericError); }
    finally { setBusy(false); }
  };

  return <section className="panel workspace-team" aria-labelledby="workspace-team-title">
    <div className="workspace-team-heading">
      <span className="settings-icon"><Users size={17} /></span>
      <div><h2 id="workspace-team-title">{t.team}</h2><p>{t.description}</p></div>
    </div>
    {!user ? <div className="workspace-team-signin"><p>{t.signIn}</p><button className="button button-white" onClick={onLogin}>{t.signIn}</button></div> : !workspaceId ? <p className="workspace-team-message">{t.migration}</p> : <>
      {owner && <form className="workspace-invite-form" onSubmit={createInvite}>
        <label>{t.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>{t.role}<select value={role} onChange={(event) => setRole(event.target.value)}><option value="editor">{t.editor}</option><option value="viewer">{t.viewer}</option></select></label>
        <button className="button button-primary" type="submit" disabled={busy || !workspaceId}><Mail size={15} />{t.invite}</button>
      </form>}
      {inviteUrl && <div className="workspace-invite-link"><input aria-label={t.invite} value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><button className="button button-white" onClick={copyInvite}><Clipboard size={15} />{copied ? <Check size={15} /> : t.copy}</button></div>}
      {message && <p className="workspace-team-message" role="status">{message}</p>}
      <div className="workspace-members-heading"><h3>{t.members}</h3>{loading && <span>{t.loading}</span>}</div>
      {!loading && members.length === 0 && <p className="workspace-team-empty">{t.empty}</p>}
      {members.length > 0 && <ul className="workspace-member-list">{members.map((member) => <li key={member.user_id}>
        <span className="workspace-member-avatar"><Users size={15} /></span><span className="workspace-member-info"><b>{member.display_name || member.email}</b><small>{member.email}</small></span>
        <span className={`workspace-member-role role-${member.role}`}>{member.role === "owner" ? <><Shield size={13} />{t.owner}</> : member.role === "editor" ? t.roleEditor : t.roleViewer}</span>
        {owner && member.role !== "owner" && <button className="workspace-member-remove" aria-label={`${t.remove}: ${member.email}`} title={t.remove} disabled={busy} onClick={() => removeMember(member)}><UserMinus size={15} /></button>}
      </li>)}</ul>}
    </>}
  </section>;
}

export function invitationText(locale) { return (text[locale] || text.en).inviteBanner; }
export function invitationSwitchText(locale, mode) {
  const item = text[locale] || text.en;
  return mode === "register" ? item.switchAccount : item.switchRegister;
}
