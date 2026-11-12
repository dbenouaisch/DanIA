(function(){
var site=document.getElementById("site"),btn=document.getElementById("menuBtn"),nav=document.getElementById("nav"),lbl=document.getElementById("menuLbl");
function setMenu(o,f){site.classList.toggle("menu-open",o);btn.setAttribute("aria-expanded",o);lbl.textContent=o?"Fermer":"Menu";if(o){nav.querySelector("a").focus()}else if(f){btn.focus()}}
btn.addEventListener("click",function(){setMenu(!site.classList.contains("menu-open"))});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&site.classList.contains("menu-open"))setMenu(false,true)});
document.addEventListener("click",function(e){if(!site.classList.contains("menu-open"))return;if(!e.target.closest(".hdr")||e.target.closest("#nav a"))setMenu(false)});

/* Section active sur l’accueil */
var MAP={"formations":"formations","en-entreprise":"formations","cas-pratiques":"cas-pratiques","methode":"cas-pratiques","a-propos":"a-propos","contact":"contact"};
if(document.getElementById("formations")){
  var spy=function(){var act="";Object.keys(MAP).forEach(function(id){var el=document.getElementById(id);if(!el)return;var r=el.getBoundingClientRect();if(r.top<=120&&r.bottom>120)act=MAP[id]});
    nav.querySelectorAll("a").forEach(function(a){a.setAttribute("aria-current",a.dataset.nav===act?"true":"false")})};
  addEventListener("scroll",spy,{passive:true});spy();
}

/* Onglets des cas pratiques */
var tabs=[].slice.call(document.querySelectorAll(".tab"));
function selTab(t){tabs.forEach(function(x){var on=x===t;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1;document.getElementById(x.getAttribute("aria-controls")).hidden=!on})}
tabs.forEach(function(t,i){t.addEventListener("click",function(){selTab(t)});t.addEventListener("keydown",function(e){var j=null;if(e.key==="ArrowRight")j=(i+1)%tabs.length;if(e.key==="ArrowLeft")j=(i-1+tabs.length)%tabs.length;if(e.key==="Home")j=0;if(e.key==="End")j=tabs.length-1;if(j!==null){e.preventDefault();selTab(tabs[j]);tabs[j].focus()}})});

/* Formulaire : prépare un e-mail dans la messagerie du visiteur */
var form=document.getElementById("leadForm");if(!form)return;
var DAN_MAIL="dbenouaisch@gmail.com",done=document.getElementById("done"),call=document.getElementById("f-call"),phone=document.getElementById("phoneField"),last=null;
call.addEventListener("change",function(){phone.hidden=!call.checked;if(call.checked)document.getElementById("f-tel").focus()});
function preselect(need,fmt){form.hidden=false;done.hidden=true;var s=document.getElementById("f-need");if(need&&[].some.call(s.options,function(o){return o.value===need}))s.value=need;if(fmt){var r=form.querySelector('input[name=format][value="'+fmt+'"]');if(r)r.checked=true}}
document.addEventListener("click",function(e){var a=e.target.closest("a[data-need]");if(a)preselect(a.dataset.need,a.dataset.format)});
var q=new URLSearchParams(location.search);if(q.get("besoin"))preselect(q.get("besoin"),q.get("format"));
function err(id,eid,bad){document.getElementById(id).setAttribute("aria-invalid",bad?"true":"false");document.getElementById(eid).hidden=!bad;return bad}
form.addEventListener("submit",function(e){e.preventDefault();
  var name=document.getElementById("f-name").value.trim(),mail=document.getElementById("f-mail").value.trim(),need=document.getElementById("f-need").value,tel=document.getElementById("f-tel").value.trim();
  var bad=[err("f-name","e-name",!name)&&"f-name",err("f-mail","e-mail",!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail))&&"f-mail",err("f-need","e-need",!need)&&"f-need",err("f-tel","e-tel",call.checked&&!tel)&&"f-tel"].filter(Boolean);
  if(bad.length){document.getElementById(bad[0]).focus();return}
  var sel=document.getElementById("f-need"),fmt=form.querySelector("input[name=format]:checked");
  var needTxt=sel.options[sel.selectedIndex].text,fmtTxt=fmt?fmt.nextElementSibling.textContent:"À voir ensemble",msg=document.getElementById("f-msg").value.trim();
  var subject="Demande DAN-IA · "+needTxt.replace("Atelier · ","")+" · "+name;
  var body=["Bonjour Dan,","","Besoin : "+needTxt,"Format envisagé : "+fmtTxt,"",msg||"(pas de message)","","Nom : "+name,"E-mail : "+mail];
  if(call.checked)body.push("Merci de me rappeler au "+tel+".");
  body.push("","Envoyé depuis le formulaire du site DAN-IA");body=body.join("\n");
  last={subject:subject,body:body,href:"mailto:"+DAN_MAIL+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body)};
  document.getElementById("mailAgain").href=last.href;document.getElementById("mailAgain").removeAttribute("target");
  document.getElementById("doneTxt").textContent="Merci "+name.split(" ")[0]+". Votre messagerie s’ouvre avec la demande déjà rédigée, adressée à "+DAN_MAIL+". Relisez-la, puis cliquez sur Envoyer : Dan vous répond sous 48 h ouvrées"+(call.checked?", ou vous rappelle au "+tel:"")+".";
  var rc=document.getElementById("recap");rc.innerHTML="";[["Objet",subject],["Besoin",needTxt],["Format",fmtTxt]].forEach(function(p){var dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=p[0];dd.textContent=p[1];rc.appendChild(dt);rc.appendChild(dd)});
  document.getElementById("copyOk").textContent="";
  form.hidden=true;done.hidden=false;done.focus();
  window.location.href=last.href;
});
document.getElementById("copyMail").addEventListener("click",function(){var ok=document.getElementById("copyOk"),txt="À : "+DAN_MAIL+"\nObjet : "+last.subject+"\n\n"+last.body;
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){ok.textContent="Demande copiée. Collez-la dans un nouvel e-mail."},function(){ok.textContent="La copie automatique est bloquée par le navigateur : sélectionnez le récapitulatif ci-dessus."})}else{ok.textContent="La copie automatique est bloquée par le navigateur : sélectionnez le récapitulatif ci-dessus."}});
document.getElementById("again").addEventListener("click",function(){form.reset();phone.hidden=true;form.hidden=false;done.hidden=true;document.getElementById("f-name").focus()});
})();
