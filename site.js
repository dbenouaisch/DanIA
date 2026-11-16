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


})();
moveInd();addEventListener("load",moveInd);


(function(){
  const tabs=[...document.querySelectorAll('.cs-tabs [role="tab"]')];
  if(!tabs.length)return;
  const wrap=document.getElementById("cs-offres");
  function select(tab,focus){
    tabs.forEach(b=>{const on=b===tab;b.setAttribute("aria-selected",on);b.tabIndex=on?0:-1;document.getElementById(b.getAttribute("aria-controls")).hidden=!on});
    if(focus)tab.focus();
  }
  tabs.forEach((b,i)=>{
    b.addEventListener("click",()=>{select(b);const top=wrap.getBoundingClientRect().top;if(top<0||top>innerHeight*.4)wrap.scrollIntoView({behavior:"smooth",block:"start"})});
    b.addEventListener("keydown",e=>{let k=null;if(e.key==="ArrowRight")k=tabs[(i+1)%tabs.length];if(e.key==="ArrowLeft")k=tabs[(i-1+tabs.length)%tabs.length];if(e.key==="Home")k=tabs[0];if(e.key==="End")k=tabs[tabs.length-1];if(k){e.preventDefault();select(k,true)}});
  });
  function toggle(btn,open){
    const box=document.getElementById(btn.getAttribute("aria-controls"));
    open=open===undefined?box.hidden:open;
    box.hidden=!open;btn.setAttribute("aria-expanded",open);
    btn.querySelector(".cs-more-t").textContent=open?"Masquer le détail":"Voir le détail";
  }
  document.querySelectorAll(".cs-more-btn").forEach(b=>b.addEventListener("click",()=>toggle(b)));
  function reveal(el){
    const panel=el.closest(".cs-panel");
    if(!panel)return el;
    const tab=tabs.find(b=>b.getAttribute("aria-controls")===panel.id);if(tab)select(tab);
    const more=el.closest(".cs-more");
    if(more){const btn=document.querySelector('[aria-controls="'+more.id+'"]');if(btn)toggle(btn,true);return el}
    return wrap;
  }
  function go(id,smooth){
    const el=id&&document.getElementById(id);if(!el)return false;
    const to=reveal(el);
    requestAnimationFrame(()=>to.scrollIntoView({behavior:smooth?"smooth":"auto",block:"start"}));
    return true;
  }
  document.addEventListener("click",e=>{
    const a=e.target.closest('a[href^="#cs-"]');if(!a)return;
    const id=a.getAttribute("href").slice(1);
    if(go(id,true)){e.preventDefault();history.pushState(null,"","#"+id)}
  });
  window.addEventListener("hashchange",()=>go(location.hash.slice(1),true));
  if(location.hash.startsWith("#cs-"))go(location.hash.slice(1),false);
})();
