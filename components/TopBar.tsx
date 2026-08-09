"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
export default function TopBar() {
  const path = usePathname() ?? "";
  const [email,setEmail]=useState<string|null>(null); const [role,setRole]=useState<string|null>(null); const [ready,setReady]=useState(false);
  async function load(){const {data:{user}}=await supabase.auth.getUser(); setEmail(user?.email??null); if(user){const {data:p}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();setRole(p?.role??null)}else setRole(null);setReady(true)}
  useEffect(()=>{load();const {data:sub}=supabase.auth.onAuthStateChange(()=>load());const timer=setInterval(load,30000);return()=>{sub.subscription.unsubscribe();clearInterval(timer)}},[]);
  if(!ready||!email||path.startsWith("/worker")||path.startsWith("/admin")||path.startsWith("/account"))return null;
  const label=role==="admin"?"Admin":role==="provider"?"Provider":"Signed in";
  return <div className="strip"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap"/><span>{label} · <strong>{email}</strong></span><button onClick={async()=>{await supabase.auth.signOut();window.location.href="/"}}>Sign out</button><style jsx>{`.strip{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;padding:7px 20px;background:#f6f6f7;border-bottom:1px solid #ececee;font-family:"Nunito",system-ui,sans-serif;font-size:13.5px;color:#6b7280}.strip strong{color:#1f2933;font-weight:700}.strip button{color:#6b7280;text-decoration:none;font:inherit;background:none;border:none;cursor:pointer;padding:0}.strip button:hover{color:#6D28D9}`}</style></div>;
}
