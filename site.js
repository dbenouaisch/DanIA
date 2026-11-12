const ddEl=document.querySelector(".dd"),ddBtn=ddEl.querySelector(".dd-btn"),navInd=document.querySelector(".nav-ind");
const mobileNav=()=>getComputedStyle(document.getElementById("menuBtn")).display!=="none";
function ddSet(o){ddEl.classList.toggle("open",o);ddBtn.setAttribute("aria-expanded",o)}
ddBtn.addEventListener("click",e=>{e.stopPropagation();if(!mobileNav())ddSet(!ddEl.classList.contains("open"))});
ddEl.addEventListener("mouseenter",()=>{if(!mobileNav()&&matchMedia("(hover:hover)").matches)ddSet(true)});
ddEl.addEventListener("mouseleave",()=>{if(!mobileNav())ddSet(false)});
document.addEventListener("click",e=>{if(!e.target.closest(".dd"))ddSet(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ddEl.classList.contains("open")){ddSet(false);ddBtn.focus()}});
ddEl.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>ddSet(false)));
function moveInd(){const nv=document.getElementById("nav"),el=nv.querySelector('[data-nav][aria-current="true"]:not(.nav-cta)');if(!el||mobileNav()){navInd.style.opacity=0;return}const r=el.getBoundingClientRect(),n=nv.getBoundingClientRect();navInd.style.opacity=1;navInd.style.left=(r.left-n.left+12)+"px";navInd.style.width=(r.width-24)+"px"}
addEventListener("resize",moveInd);
const mcta=document.querySelector(".mcta");
if(mcta&&"IntersectionObserver" in window){const seen=new Set();const mctaObs=new IntersectionObserver(es=>{es.forEach(e=>e.isIntersecting?seen.add(e.target):seen.delete(e.target));mcta.classList.toggle("off",seen.size>0)});document.querySelectorAll(".hero-ctas,.dbox.aside,.endcta,#contact,#diagRoot").forEach(el=>mctaObs.observe(el))}

function onScr(){document.getElementById("site").classList.toggle("scrolled",scrollY>16)}
addEventListener("scroll",onScr,{passive:true});onScr();
(function(){
var site=document.getElementById("site"),btn=document.getElementById("menuBtn"),nav=document.getElementById("nav"),lbl=document.getElementById("menuLbl");
function setMenu(o,f){site.classList.toggle("menu-open",o);btn.setAttribute("aria-expanded",o);lbl.textContent=o?"Fermer":"Menu";if(o){nav.querySelector("a").focus()}else if(f){btn.focus()}}
btn.addEventListener("click",function(){setMenu(!site.classList.contains("menu-open"))});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&site.classList.contains("menu-open"))setMenu(false,true)});
document.addEventListener("click",function(e){if(!site.classList.contains("menu-open"))return;if(!e.target.closest(".hdr")||e.target.closest("#nav a"))setMenu(false)});


var MAP={"formations":"formations","en-entreprise":"formations","cas-pratiques":"cas-pratiques","methode":"cas-pratiques","a-propos":"a-propos","contact":"contact"};
if(document.getElementById("formations")){
  var spy=function(){var act="";Object.keys(MAP).forEach(function(id){var el=document.getElementById(id);if(!el)return;var r=el.getBoundingClientRect();if(r.top<=120&&r.bottom>120)act=MAP[id]});
    nav.querySelectorAll("[data-nav]").forEach(function(a){a.setAttribute("aria-current",a.dataset.nav===act?"true":"false")});moveInd()};
  addEventListener("scroll",spy,{passive:true});spy();
}


var tabs=[].slice.call(document.querySelectorAll(".tab"));
function selTab(t){tabs.forEach(function(x){var on=x===t;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1;document.getElementById(x.getAttribute("aria-controls")).hidden=!on})}
tabs.forEach(function(t,i){t.addEventListener("click",function(){selTab(t)});t.addEventListener("keydown",function(e){var j=null;if(e.key==="ArrowRight")j=(i+1)%tabs.length;if(e.key==="ArrowLeft")j=(i-1+tabs.length)%tabs.length;if(e.key==="Home")j=0;if(e.key==="End")j=tabs.length-1;if(j!==null){e.preventDefault();selTab(tabs[j]);tabs[j].focus()}})});


var form=document.getElementById("leadForm");if(!form)return;
var done=document.getElementById("done"),call=document.getElementById("f-call"),phone=document.getElementById("phoneField");
call.addEventListener("change",function(){phone.hidden=!call.checked;if(call.checked)document.getElementById("f-tel").focus()});
function preselect(need,fmt){form.hidden=false;done.hidden=true;var s=document.getElementById("f-need");if(need&&[].some.call(s.options,function(o){return o.value===need}))s.value=need;if(fmt){var r=form.querySelector('input[name=format][value="'+fmt+'"]');if(r)r.checked=true}}
document.addEventListener("click",function(e){var a=e.target.closest("a[data-need]");if(a)preselect(a.dataset.need,a.dataset.format)});
var q=new URLSearchParams(location.search);if(q.get("besoin"))preselect(q.get("besoin"),q.get("format"));
function err(id,eid,bad){document.getElementById(id).setAttribute("aria-invalid",bad?"true":"false");document.getElementById(eid).hidden=!bad;return bad}
var ENDPOINT=form.getAttribute("action"),btn=document.getElementById("sendBtn"),sendErr=document.getElementById("sendErr"),busy=false;
form.addEventListener("submit",function(e){e.preventDefault();if(busy)return;
  var name=document.getElementById("f-name").value.trim(),mail=document.getElementById("f-mail").value.trim(),need=document.getElementById("f-need").value,tel=document.getElementById("f-tel").value.trim();
  var bad=[err("f-name","e-name",!name)&&"f-name",err("f-mail","e-mail",!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail))&&"f-mail",err("f-need","e-need",!need)&&"f-need",err("f-tel","e-tel",call.checked&&!tel)&&"f-tel"].filter(Boolean);
  if(bad.length){document.getElementById(bad[0]).focus();return}
  var sel=document.getElementById("f-need"),fmt=form.querySelector("input[name=format]:checked");
  var needTxt=sel.options[sel.selectedIndex].text,fmtTxt=fmt?fmt.nextElementSibling.textContent:"À voir ensemble",msg=document.getElementById("f-msg").value.trim();
  var subject="Demande DAN-IA · "+needTxt.replace("Atelier · ","")+" · "+name;
  var data={"Nom":name,"email":mail,"Besoin":needTxt,"Format envisagé":fmtTxt,"Message":msg||"(pas de message)","Rappel souhaité":call.checked?"Oui, au "+tel:"Non","Page":location.pathname,"_subject":subject,"_gotcha":form.querySelector("input[name=_gotcha]").value};
  busy=true;sendErr.hidden=true;btn.disabled=true;btn.textContent="Envoi en cours…";
  fetch(ENDPOINT,{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify(data)})
  .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);
    document.getElementById("doneTxt").textContent="Merci "+name.split(" ")[0]+". Dan a bien reçu votre demande et vous répond sous 48 h ouvrées"+(call.checked?", ou vous rappelle au "+tel:" à "+mail)+".";
    var rc=document.getElementById("recap");rc.innerHTML="";[["Besoin",needTxt],["Format",fmtTxt]].forEach(function(p){var dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=p[0];dd.textContent=p[1];rc.appendChild(dt);rc.appendChild(dd)});
    form.hidden=true;done.hidden=false;done.focus();})
  .catch(function(){sendErr.hidden=false;sendErr.focus();})
  .then(function(){busy=false;btn.disabled=false;btn.textContent="Envoyer ma demande";});
});
document.getElementById("again").addEventListener("click",function(){form.reset();sendErr.hidden=true;phone.hidden=true;form.hidden=false;done.hidden=true;document.getElementById("f-name").focus()});
})();
moveInd();addEventListener("load",moveInd);

const DQ=[
 {q:"Vous utilisez l’IA pour préparer un rendez-vous client. Que lui donnez-vous comme consigne ?",d:"q",o:[["Je lui demande des idées pour le rendez-vous.",0],["Je lui indique le sujet et le type de client.",1],["Je lui précise le contexte, mon objectif et ce que je veux obtenir.",2]]},
 {q:"L’IA vous donne un chiffre à reprendre dans une présentation. Que faites-vous ?",d:"q",o:[["Je vérifie le chiffre dans la source d’origine.",2],["Je demande à l’IA de confirmer le chiffre.",1],["Je le reprends s’il me paraît plausible.",0]]},
 {q:"Vous voulez résumer un document qui contient des noms de clients. Que vérifiez-vous d’abord ?",d:"q",o:[["Je masque les noms visibles.",1],["Je vérifie que l’outil est autorisé pour ces données et je retire ce qui n’est pas nécessaire.",2],["Je me demande surtout si le document est assez clair pour être résumé.",0]]},
 {q:"Comment retrouvez-vous les e-mails qui attendent une réponse ou une relance ?",d:"b",o:[["Je les repère en relisant ma boîte.",0],["Je les marque ou les classe à la main.",1],["Je les retrouve dans un suivi où la prochaine action et l’échéance sont visibles.",2],["Je ne fais pas cette tâche",null]]},
 {q:"Un total vous surprend dans un tableau de suivi. Que faites-vous ?",d:"b",o:[["Je compare le total avec celui du mois précédent.",0],["Je vérifie quelques lignes et la formule du total.",1],["Je remonte au fichier source et vérifie que le calcul inclut les bonnes lignes et les bons montants.",2],["Je ne fais pas cette tâche",null]]},
 {q:"Vous devez reprendre un document déjà modifié plusieurs fois. Comment retrouvez-vous la bonne version ?",d:"b",o:[["Je regarde le fichier le plus récent dans mes dossiers ou mes e-mails.",0],["Je repère la version grâce au nom du fichier.",1],["J’ouvre le document de référence et son historique si besoin.",2],["Je ne fais pas cette tâche",null]]},
 {q:"Quelle tâche régulière sauriez-vous décrire à un assistant IA aujourd’hui ?",d:"a",o:[["Je cherche encore une tâche qui s’y prête.",0],["J’ai une tâche en tête et je sais dans quelles situations elle revient.",1],["Je sais aussi ce que l’assistant devrait me fournir et quelles décisions je garderais.",2]]},
 {q:"Avez-vous déjà configuré un assistant IA pour réutiliser les mêmes consignes ?",d:"a",o:[["Je réutilise parfois une consigne en la copiant.",1],["J’ai configuré un assistant avec ses consignes, ses sources et le résultat attendu.",2],["Je n’ai encore rien configuré de ce type.",0]]},
 {q:"Votre assistant doit repérer les e-mails urgents. Comment le testez-vous ?",d:"a",o:[["Je lui montre quelques messages typiques.",1],["Je lui donne un exemple pour voir si le résultat me convient.",0],["Je teste aussi les cas ambigus, comme une échéance modifiée ou une demande déjà traitée, et je garde la validation finale.",2]]},
 {q:"Quel résultat vous serait le plus utile le mois prochain ?",d:"g",o:[["Mieux utiliser l’IA pour préparer, rédiger et vérifier.","q"],["Simplifier mes e-mails, mes documents ou mes tableaux de suivi.","b"],["Créer un assistant pour mon briefing ou une autre tâche récurrente.","a"],["J’aimerais d’abord savoir par où commencer.","h"]]}
];
const DOM={q:{name:"Préparer, rédiger, vérifier",k:"ia-au-quotidien",qs:[0,1,2]},b:{name:"Organisation et suivi",k:"bureautique",qs:[3,4,5]},a:{name:"Assistant IA",k:"agent-ia",qs:[6,7,8]}};
const TITLE={"ia-au-quotidien":"L’IA au quotidien","bureautique":"Bureautique boostée par l’IA","agent-ia":"Créer son agent IA"};
const STRONG=[
 ["Vous précisez déjà à l’IA le sujet et le type de client. Bonne base.","Vous donnez déjà à l’IA le contexte et votre objectif. C’est le réflexe qui change le plus la qualité des réponses."],
 ["Vous ne reprenez pas un chiffre sans le questionner. C’est un bon début.","Vous vérifiez les chiffres à la source avant de les reprendre. Peu de gens le font."],
 ["Vous pensez déjà à masquer les noms de vos clients.","Avant de confier des données clients, vous vérifiez que l’outil est autorisé. Exactement la bonne prudence."],
 ["Vous classez déjà vos e-mails à traiter.","Vos relances sont suivies, échéance comprise. Votre organisation tient la route."],
 ["Quand un total vous surprend, vous vérifiez la formule.","Quand un total vous surprend, vous remontez au fichier source. Un vrai réflexe de contrôle."],
 ["Vous nommez vos fichiers pour retrouver la bonne version.","Vous partez toujours du document de référence. C’est ce qui rend le travail à plusieurs serein."],
 ["Vous avez déjà en tête une tâche à confier à un assistant.","Vous savez ce que l’assistant devrait vous fournir, et ce que vous gardez pour vous. C’est le cœur de la conception d’un agent."],
 ["Vous réutilisez déjà vos bonnes consignes.","Vous avez déjà configuré un assistant avec ses consignes. Vous partez avec une longueur d’avance."],
 ["Vous testez déjà votre assistant sur des messages typiques.","Vous testez les cas ambigus et gardez la validation finale. C’est la bonne méthode."]
];
let A=Array(10).fill(null),step=-1,why=false;
const root2=()=>document.getElementById("diagRoot");
const agentSVG=`<svg class="agent-mini" viewBox="0 0 64 72" aria-hidden="true"><defs><linearGradient id="dgB" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#c77dff"/><stop offset=".55" stop-color="#7b5cff"/><stop offset="1" stop-color="#2ee6f0"/></linearGradient><radialGradient id="dgH" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#f3c2ff"/><stop offset=".45" stop-color="#9b5cff"/><stop offset="1" stop-color="#3fd8f5"/></radialGradient><radialGradient id="dgI" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#7dfbe9"/><stop offset="1" stop-color="#14a3c7"/></radialGradient><radialGradient id="dgG"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".6"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient></defs><ellipse cx="32" cy="68" rx="22" ry="4" fill="url(#dgG)"/><g class="fl"><rect x="17" y="46" width="30" height="20" rx="7" fill="url(#dgB)"/><path d="M22 51l10 6 10-6" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linejoin="round"/><rect x="27" y="40" width="10" height="7" rx="2" fill="#3a2a9e"/><line x1="32" y1="12" x2="32" y2="5" stroke="#b9a6ff" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="4" r="5" fill="#3ff5e0" opacity=".3" class="pl"/><circle cx="32" cy="4" r="2.6" fill="#3ff5e0"/><rect x="12" y="23" width="5" height="10" rx="2" fill="#4b35c9"/><rect x="47" y="23" width="5" height="10" rx="2" fill="#4b35c9"/><circle cx="32" cy="28" r="17" fill="url(#dgH)"/><ellipse cx="25.5" cy="20" rx="5.5" ry="3" fill="#fff" opacity=".5" transform="rotate(-32 25.5 20)"/><ellipse cx="37" cy="29.5" rx="7.5" ry="8.3" fill="#1a1f4e"/><circle cx="38.6" cy="29.5" r="4" fill="url(#dgI)"/><circle cx="40.2" cy="27.7" r="1.3" fill="#fff"/></g></svg>`;
const tick=`<span class="dot" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.2l2.3 2.3L9.5 3.6"/></svg></span>`;

function scores(){return A.map((a,i)=>a===null||i===9?null:DQ[i].o[a][1])}
function domain(d){const S=scores(),v=DOM[d].qs.map(i=>S[i]).filter(x=>x!==null&&x!==undefined);if(v.length<2)return{lvl:"À préciser",c:"pn",avg:null,n:v.length};const avg=v.reduce((a,b)=>a+b,0)/v.length;return avg<.75?{lvl:"À découvrir",c:"p0",avg}:avg<1.5?{lvl:"En pratique",c:"p1",avg}:{lvl:"Déjà solide",c:"p2",avg}}
function ans(i){return A[i]===null?"":DQ[i].o[A[i]][0]}
function quote(i){return `<b>Question ${i+1}</b> · « ${ans(i)} »`}

function recommend(){
  const S=scores(),goal=DQ[9].o[A[9]][1],L={q:domain("q"),b:domain("b"),a:domain("a")},why=[],R={};
  why.push(`<b>Objectif</b> (question 10) · « ${ans(9)} »`);
  if(goal==="q"){R.k="ia-au-quotidien";
    const w=[0,1,2].sort((x,y)=>(S[x]??3)-(S[y]??3))[0];
    R.why=[ ["Vous gagnerez surtout à formuler des demandes plus précises : contexte, objectif, format attendu.","Vous gagnerez surtout à vérifier ce que l’IA vous répond avant de le reprendre.","Vous gagnerez surtout à savoir quelles données confier à quel outil."][w], "L’atelier travaille ce point sur des cas proches de votre quotidien, avec une méthode que vous réutilisez dès le lendemain."];
    why.push(quote(w)+" · c’est le point le plus utile à travailler.");
    if(S[6]>=1){R.k2="agent-ia";R.k2t="Vous avez déjà une tâche régulière en tête : une fois ces réflexes acquis, vous pourrez la confier à un assistant.";why.push(quote(6)+" · d’où la suite proposée.")}
  }else if(goal==="b"){R.k="bureautique";
    const tasks=[3,4,5].filter(i=>S[i]!==null);
    const noRep=S[4]===null;
    R.why=[noRep?"Vous n’avez pas de reporting à produire : l’atelier vous servira surtout pour vos e-mails et vos documents.":"Vous repartirez avec une organisation plus simple pour vos e-mails, vos documents et vos tableaux de suivi.","Chaque exercice part d’une situation courante, et vous l’appliquez ensuite à vos propres fichiers."];
    tasks.forEach(i=>why.push(quote(i)));
    if(noRep)why.push(quote(4)+" · la partie reporting passe au second plan.");
    if(L.q.lvl==="À découvrir"){R.k2="ia-au-quotidien";R.k2t="Pour vous appuyer davantage sur l’IA dans vos e-mails et vos tableaux, cet atelier vous donnera les bons réflexes de départ.";why.push(`Vos réponses aux questions 1 à 3 situent vos pratiques IA à « À découvrir » · d’où le complément proposé.`)}
    R.tasks=tasks;
  }else if(goal==="a"){
    if(S[0]===0&&S[1]===0){R.k="ia-au-quotidien";R.k2="agent-ia";R.prep=true;
      R.why=["Pour qu’un assistant vous fasse vraiment gagner du temps, il faut savoir lui donner une consigne précise et vérifier ce qu’il produit.","Ce premier atelier vous donne ces deux bases. Vous serez ensuite prêt à construire votre assistant."];
      R.k2t="C’est l’étape suivante naturelle : vous y construirez l’assistant que vous avez en tête, sans code.";
      why.push(quote(0)+" · la consigne est encore à préciser.");why.push(quote(1)+" · la vérification est encore à installer.");why.push("Ces deux bases manquent : nous recommandons de commencer par L’IA au quotidien.");
    }else{R.k="agent-ia";
      R.why=["Vous avez déjà les bases pour formuler une demande et vérifier une réponse : vous pouvez passer à la conception d’un assistant.", S[7]===0?"Vous n’avez encore rien configuré ? Ce n’est pas un prérequis : l’atelier part de zéro sur la configuration.":"L’atelier vous fait concevoir, tester et valider un assistant pour une tâche qui revient chaque semaine."];
      why.push(S[0]>=1?quote(0)+" · base suffisante pour formuler une demande.":quote(1)+" · base suffisante pour vérifier une réponse.");
      if(S[7]===0)why.push(quote(7)+" · ce n’est pas un frein pour suivre l’atelier.");
    }
  }else{
    const allSolid=["q","b","a"].every(d=>L[d].lvl==="Déjà solide");
    if(allSolid){const d=["q","b","a"].sort((x,y)=>L[x].avg-L[y].avg)[0];R.k=DOM[d].k;R.perf=true;
      R.why=["Vos pratiques sont déjà solides dans les trois domaines.",`${TITLE[R.k]} est la piste de perfectionnement la plus utile pour vous : c’est là que votre marge de progrès reste la plus nette.`];
      why.push("Vos trois repères sont « Déjà solide » · nous proposons un perfectionnement.");}
    else if(["À découvrir","À préciser"].includes(L.q.lvl)){R.k="ia-au-quotidien";
      R.why=["C’est la meilleure première étape : on y apprend à formuler une demande, vérifier une réponse et protéger ses données.","Ces réflexes servent ensuite dans tous les autres usages de l’IA."];
      why.push(`Vos réponses aux questions 1 à 3 situent vos pratiques IA à « ${L.q.lvl} » · c’est le socle à poser en premier.`);
      if(S[6]>=1){R.k2="agent-ia";R.k2t="Vous avez déjà une tâche régulière en tête : vous pourrez ensuite la confier à un assistant.";why.push(quote(6)+" · d’où la suite proposée.")}
    }else if(L.b.lvl==="À découvrir"){R.k="bureautique";R.why=["Vous utilisez déjà bien l’IA. Votre organisation est le terrain où vous gagnerez le plus vite.","L’atelier simplifie le suivi de vos e-mails, de vos documents et de vos tableaux."];why.push(`Vos réponses aux questions 4 à 6 situent votre organisation à « À découvrir ».`)}
    else{R.k="agent-ia";R.why=["Vous avez de bonnes bases avec l’IA et une organisation déjà structurée.","La prochaine étape utile : confier une tâche récurrente à un assistant que vous concevez vous-même."];why.push(`Vos repères IA et organisation sont déjà « ${L.q.lvl} » et « ${L.b.lvl} » · l’étape suivante est l’assistant.`)}
  }
  R.L=L;R.goal=goal;R.reasons=why;return R;
}

function benefits(R){const S=scores();
  if(R.k==="ia-au-quotidien"){const B=[[S[0]??3,"Rédiger une demande complète, avec le contexte, l’objectif et le format attendu, et obtenir une réponse utilisable du premier coup."],[S[1]??3,"Vérifier un chiffre ou une source avant de le reprendre dans un document ou une présentation."],[S[2]??3,"Savoir quelles données confier à quel outil, et anonymiser un dossier client en quelques gestes."]].sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
    if(R.prep)return [B[0],B[1],"Repartir avec une première version de la consigne de votre futur assistant."];return B}
  if(R.k==="bureautique"){const M={3:"Repérer en un coup d’œil les e-mails qui attendent une réponse ou une relance, avec leur échéance.",4:"Contrôler un total surprenant et construire un tableau de suivi qui se met à jour.",5:"Retrouver la bonne version d’un document et travailler à plusieurs sur un seul fichier."};
    const t=(R.tasks&&R.tasks.length?R.tasks:[3,4,5]).slice().sort((x,y)=>S[x]-S[y]);return t.slice(0,3).map(i=>M[i])}
  const B=[[S[6]??3,"Choisir une tâche qui revient chaque semaine et décrire précisément ce que l’assistant doit vous fournir."],[S[7]??3,"Construire sans code un assistant qui prépare votre briefing du matin à partir de vos e-mails et de votre agenda."],[S[8]??3,"Le tester sur des cas ambigus avant de lui faire confiance, en gardant la décision finale."]];
  return B.sort((x,y)=>x[0]-y[0]).map(x=>x[1]);
}
function constat(R){const S=scores();let best=null;
  const dk=Object.keys(DOM).find(d=>DOM[d].k===R.k)||"q";
  const pick=qs=>{let b=null;for(const i of qs){if(S[i]!==null&&S[i]>=1&&(b===null||S[i]>S[b]))b=i}return b};
  best=pick(DOM[dk].qs);if(best===null)best=pick([0,1,2,3,4,5,6,7,8]);
  if(best!==null&&best!==undefined)return STRONG[best][S[best]-1];
  return {q:"Vous voulez mieux préparer, rédiger et vérifier avec l’IA : c’est le bon point de départ.",b:"Vous voulez simplifier votre organisation : c’est souvent là que l’on gagne le plus vite.",a:"Vous savez ce que vous voulez construire : un assistant pour une tâche récurrente. C’est un excellent point de départ.",h:"Vous avez pris le temps de faire le point : c’est la meilleure façon de bien commencer."}[R.goal];
}

function render(){const r=root2();if(!r)return;
  if(step<0){r.innerHTML=`<div class="dq-card dq-intro"><div class="dq-intro-top">${agentSVG}<p class="kick" style="margin:0">Diagnostic IA · gratuit</p></div>
   <h1 id="dq-h" tabindex="-1">Quel atelier IA est fait pour vous ?</h1>
   <p class="sub">Dix questions courtes sur votre façon de travailler aujourd’hui. Pas besoin d’être expert : choisissez à chaque fois la réponse qui vous ressemble le plus.</p>
   <ul class="dq-facts"><li>10 questions</li><li>Environ 3 minutes</li><li>Résultat immédiat, sans inscription</li></ul>
   <button class="btn btn-primary" type="button" id="dqStart">Commencer le diagnostic</button>
   <div class="demo"><p>Maquette · parcours de démonstration</p><div>${[].map((d,i)=>`<button type="button" data-demo="${i}">${d.n}</button>`).join("")}</div></div></div>`;
   r.querySelector("#dqStart").onclick=()=>go(0);r.querySelectorAll("[data-demo]").forEach(b=>b.onclick=()=>demo(+b.dataset.demo));focusH();return}
  if(step>=10){renderResult();return}
  const Q=DQ[step],sel=A[step];
  r.innerHTML=`<form class="dq-card" id="dqForm"><div class="dq-top"><span><b>Question ${step+1}</b> sur 10</span><a class="link" href="/" style="min-height:0;font-weight:400;color:var(--muted)">Quitter</a></div>
   <div class="dq-bar" role="progressbar" aria-label="Progression" aria-valuemin="1" aria-valuemax="10" aria-valuenow="${step+1}"><i style="width:${(step+1)*10}%"></i></div>
   <fieldset class="dq-opts"><legend class="dq-q" id="dq-h" tabindex="-1">${Q.q}</legend>
   <p class="dq-hint">${step===9?"Choisissez l’objectif le plus proche du vôtre.":step<3||step>5?"Choisissez la réponse qui ressemble le plus à ce que vous feriez, même si vous débutez.":"Choisissez la réponse qui ressemble le plus à votre façon de travailler."}</p>
   ${Q.o.map((o,i)=>`<label class="dq-opt${o[1]===null?" none":""}"><input type="radio" name="dq" value="${i}"${sel===i?" checked":""}>${tick}<span>${o[0]}</span></label>`).join("")}</fieldset>
   <div class="dq-nav"><button class="btn btn-quiet" type="button" id="dqBack">Retour</button><button class="btn btn-primary" type="submit" id="dqNext"${sel===null?" disabled":""}>${step===9?"Voir mon résultat":"Continuer"}</button></div></form>`;
  const f=r.querySelector("#dqForm");
  f.addEventListener("change",e=>{A[step]=+e.target.value;r.querySelector("#dqNext").disabled=false});
  f.addEventListener("submit",e=>{e.preventDefault();if(A[step]!==null)go(step+1)});
  r.querySelector("#dqBack").onclick=()=>go(step-1);
  focusH();
}
function renderResult(){const R=recommend(),r=root2();const B=benefits(R);
  r.innerHTML=`<div class="res"><div class="res-hello">${agentSVG}<div class="bubble"><p class="kick">Votre profil IA</p><p>${constat(R)}</p></div></div>
  <section class="res-main" aria-labelledby="dq-h"><p class="kick">Votre première étape</p><h2 id="dq-h" tabindex="-1">${TITLE[R.k]}${R.perf?'<span class="tag">Perfectionnement</span>':""}</h2>
   <p class="why2">${R.why.join(" ")}</p>
   <div class="hero-ctas on-night"><a class="btn btn-primary" href="/${R.k}">Voir la formation recommandée</a><a class="btn btn-ghost" href="https://calendly.com/dbenouaisch" target="_blank" rel="noopener">Prendre rendez-vous avec Dan<span class="vh"> (nouvel onglet)</span></a></div></section>
  <div class="res-grid"><div class="rcard"><h3>Ce que vous pourrez faire après l’atelier</h3><ul class="ben">${B.map(b=>`<li>${b}</li>`).join("")}</ul></div>
   <div class="rcard soft"><h3>Vos repères</h3><ul class="lv">${["q","b","a"].map(d=>`<li><span>${DOM[d].name}</span><span class="pill ${R.L[d].c}">${R.L[d].lvl}</span></li>`).join("")}</ul><p class="note">Établis à partir de vos réponses. « À préciser » : pas assez de réponses dans ce domaine.</p></div></div>
  ${R.k2?`<div class="next"><p><b>Et ensuite : ${TITLE[R.k2]}</b>${R.k2t}</p><a class="btn btn-quiet btn-sm" href="/${R.k2}">Voir cette formation</a></div>`:""}
  <details class="why"${why?" open":""}><summary>Pourquoi cette recommandation ?</summary><ul>${R.reasons.map(x=>`<li>${x}</li>`).join("")}</ul></details>
  <div class="res-foot"><button class="btn btn-quiet btn-sm" type="button" id="dqEdit">Modifier mes réponses</button><button class="btn btn-quiet btn-sm" type="button" id="dqRestart">Recommencer</button><span class="sp"></span><a class="link" href="/formations?besoin=${R.k}#contact">Ou m’écrire via le formulaire</a></div></div>`;
  r.querySelector("#dqEdit").onclick=()=>go(9);r.querySelector("#dqRestart").onclick=()=>{A=Array(10).fill(null);why=false;go(-1)};
  focusH();
}
function focusH(){requestAnimationFrame(()=>{const h=document.getElementById("dq-h");if(h)h.focus({preventScroll:true});window.scrollTo({top:0})})}
function go(n){step=Math.max(-1,Math.min(10,n));render()}
const DEMOS_UNUSED=[
 {n:"1 · L’IA au quotidien",a:[1,1,0,1,1,1,0,0,1,0]},
 {n:"2 · Bureautique (manager)",a:[2,0,1,0,0,0,1,2,0,1]},
 {n:"3 · Créer son agent IA",a:[2,0,1,2,2,2,2,2,2,2]},
 {n:"4 · Débutant qui veut un agent",a:[0,2,2,0,3,0,0,2,1,2]},
 {n:"5 · Indépendant sans reporting",a:[1,0,0,0,3,1,1,0,0,1]}
];
function demo(i){A=DEMOS_UNUSED[i].a.slice();why=true;if(location.hash!=="#diagnostic")location.hash="diagnostic";setTimeout(()=>go(10),30)}

if(document.getElementById("diagRoot"))render();
