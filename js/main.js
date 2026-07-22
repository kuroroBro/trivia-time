import * as game from "./game.js";
import { reconcileDraft } from "./draft.js";
import { QUESTIONS, THEMES } from "./questions.js";
import { hostRoom, joinRoom, normalizeCode } from "./room.js";
import { unlockAudio, playGameStart } from "./sound.js";
import { createResumeToken, loadSession, loadSettings, loadUsedIds, markUsedIds, resetUsedIds, saveSession, saveSettings } from "./storage.js";
import { recordShowResult } from "./leaderboard.js";

const HOST_ID = "host";
const $ = (id) => document.getElementById(id);
let isHost = false, room = null, net = null, state = null, stateReceivedAt = Date.now(), myId = null, activeToken = null, raf = null, autoAdvancedFor = null, lastPhase = null;
let draftQuestionId = null, answerDraft = "";
const screens = ["home", "lobby", "question", "reveal", "over"];
const show = (name) => screens.forEach((x) => $(`screen-${x}`).classList.toggle("hidden", x !== name));
function toast(text) { const el=$("toast"); el.textContent=text; el.classList.remove("hidden"); setTimeout(()=>el.classList.add("hidden"),2400); }
function renderHistoryReset() { const count=loadUsedIds().length,button=$("reset-history-btn");button.textContent=count?`Reset question history (${count} used)`:"Question history is empty";button.disabled=count===0; }
const me = () => state?.players.find((p) => p.id === myId);

function roster(id) {
  const el=$(id); el.innerHTML="";
  for (const p of state.players) { const chip=document.createElement("div"); chip.className=`person${p.id===myId?" me":""}${p.locked?" locked":""}${!p.connected?" offline":""}`; chip.textContent=`${p.name}${p.id===state.hostId?" ★":""} · ${p.score}`; el.appendChild(chip); }
}

function renderLobby() {
  $("room-code").textContent=state.code; roster("lobby-roster");
  const url=`${location.origin}${location.pathname}?room=${encodeURIComponent(state.code)}`;
  $("qr-image").src=`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
  $("qr-image").alt=`QR code to join room ${state.code}`;
  $("copy-btn").onclick=()=>navigator.clipboard?.writeText(url).then(()=>toast("Join link copied"));
  const mine=myId===state.hostId; $("host-settings").classList.toggle("hidden",!mine);
  $("lobby-message").textContent=mine?"Choose categories and start when everyone is ready.":"Waiting for the Host to start…";
  if(mine)renderHistoryReset();
}

function renderQuestion() {
  const q=state.question; $("progress").textContent=`Round ${state.roundIndex+1} of ${state.deckLength}`; $("category-chip").textContent=q.category;
  $("theme-label").textContent=q.theme||""; $("question-prompt").textContent=q.prompt; roster("question-roster");
  const player=me(), area=$("answer-area"); area.classList.toggle("hidden",!player);
  if (player) {
    const input=$("answer-input");
    const draft=reconcileDraft({questionId:q.id,draftQuestionId,answerDraft,serverAnswer:player.myAnswer,locked:player.locked});
    draftQuestionId=draft.draftQuestionId;answerDraft=draft.answerDraft;
    if(draft.shouldWrite&&input.value!==answerDraft)input.value=answerDraft;
    input.disabled=player.locked; $("lock-btn").disabled=player.locked;
    $("lock-status").textContent=player.locked?"✓ Locked in — waiting for the others":"Your answer stays private until reveal.";
    if(draft.shouldFocus)setTimeout(()=>input.focus(),0);
  }
}

function renderReveal() {
  const r=state.lastResult; $("reveal-category").textContent=[r.category,r.theme].filter(Boolean).join(" · "); $("reveal-prompt").textContent=r.prompt;
  $("answer-label").textContent=r.acceptedAnswers.length>1?"Accepted answers":"Accepted answer"; $("accepted-answers").textContent=r.acceptedAnswers.join(" • "); $("explanation").textContent=r.explanation;
  const list=$("result-list"); list.innerHTML="";
  for(const res of r.results){ const row=document.createElement("div"); row.className=`result${res.correct?" correct":""}`;
    const name=document.createElement("strong"); name.textContent=`${res.correct?"✓":"✕"} ${res.name}`; const response=document.createElement("span"); response.className="response"; response.textContent=`${res.answerText||"No answer"} · ${res.reason}`;
    const score=document.createElement("span"); score.className="score"; score.textContent=`${res.score} pt${res.score===1?"":"s"}`; row.append(name,response,score);
    if(myId===state.hostId){ const actions=document.createElement("div"); actions.className="actions"; const yes=document.createElement("button"),no=document.createElement("button"); yes.className=no.className="btn small"; yes.textContent="Mark correct"; no.textContent="Mark wrong"; yes.onclick=()=>act("override",{playerId:res.playerId,correct:true}); no.onclick=()=>act("override",{playerId:res.playerId,correct:false}); actions.append(yes,no); row.appendChild(actions); }
    list.appendChild(row); }
  $("next-btn").classList.toggle("hidden",myId!==state.hostId); $("next-btn").textContent=state.roundIndex+1===state.deckLength?"See final scores":"Next question";
}

function renderOver(){ const winners=state.standings.filter((p)=>state.winnerIds.includes(p.id)); $("winner-title").textContent=winners.length===1?`${winners[0].name} wins!`:`${winners.map((p)=>p.name).join(" & ")} tie!`; const list=$("standings");list.innerHTML="";state.standings.forEach((p,i)=>{const row=document.createElement("div");row.className="result rank";row.textContent=`${i+1}. ${p.name} — ${p.score} point${p.score===1?"":"s"}`;list.appendChild(row)});$("again-btn").classList.toggle("hidden",myId!==state.hostId)}

// The quiz actually begins the moment everyone leaves the lobby for the
// first question — fires once per game (including a replay via "Play
// again", which resets to "lobby" first), never on the timer-driven
// re-renders that already happen throughout "question".
function render(){ if(!state){lastPhase=null;return;} if(state.phase==="question"&&lastPhase==="lobby")playGameStart(); lastPhase=state.phase; cancelAnimationFrame(raf); show(state.phase); if(state.phase==="lobby")renderLobby();if(state.phase==="question")renderQuestion();if(state.phase==="reveal")renderReveal();if(state.phase==="over")renderOver();tick(); }
function tick(){
  if(!state)return; const now=state.hostNow+(Date.now()-stateReceivedAt);
  if(state.phase==="question"&&state.questionDeadlineAt){const left=Math.max(0,state.questionDeadlineAt-now),total=state.settings.timerSeconds*1000;$("timer").classList.remove("hidden");$("timer").style.setProperty("--pct",`${left/total*100}%`);$("timer").querySelector("span").textContent=`${Math.ceil(left/1000)}s`;if(left<=0&&isHost)act("tick",{});}
  if(state.phase==="reveal"&&state.settings.revealAdvanceSeconds){const total=state.settings.revealAdvanceSeconds*1000,left=Math.max(0,state.revealStartedAt+total-now);$("reveal-timer").classList.remove("hidden");$("reveal-timer").style.setProperty("--pct",`${left/total*100}%`);$("reveal-timer").querySelector("span").textContent=`Next in ${Math.ceil(left/1000)}s`;const key=`${state.roundIndex}:${state.revealStartedAt}`;if(left<=0&&isHost&&autoAdvancedFor!==key){autoAdvancedFor=key;act("advance",{});}}
  raf=requestAnimationFrame(tick);
}

function applyState(next){state=next;stateReceivedAt=Date.now();render();}
function push(){const now=Date.now();state=game.toPublicState(room,myId,now);stateReceivedAt=now;net?.broadcastEach?.("state",(id)=>game.toPublicState(room,id,now));render();}
// Records the finished show for the cross-game Leader Board, from the same
// final state renderOver() shows the players -- see
// leader-board/specs/001-leader-board/. Host-only (runs inside handle(),
// which only runs on the Host device).
function recordShow(){recordShowResult({game:"trivia-time",gameName:"Trivia Time",players:room.players.map((p)=>({name:p.name,score:p.score||0})),winners:room.players.filter((p)=>(room.winnerIds||[]).includes(p.id)).map((p)=>p.name),meta:{questions:room.deck?.length}});}
function handle(playerId,event,payload={}){
  let res;
  if(event==="join"){const re=payload.resumeToken&&game.rejoinPlayer(room,playerId,payload.resumeToken);if(re?.ok)res={ok:true,rejoined:true};else res=game.addPlayer(room,playerId,payload.name,payload.resumeToken);if(res.ok)queueMicrotask(push);return{...res,state:res.ok?game.toPublicState(room,playerId):null};}
  if(event==="rename")res=game.renamePlayer(room,playerId,payload.name);
  if(event==="start")res=game.startGame(room,playerId,{pool:QUESTIONS,settings:payload.settings,usedIds:loadUsedIds(),now:Date.now()});
  if(event==="answer")res=game.submitAnswer(room,playerId,payload.answer,Date.now());
  if(event==="override")res=game.overrideJudgment(room,playerId,payload.playerId,payload.correct,Date.now());
  if(event==="advance"){res=game.advanceRound(room,playerId,Date.now());if(res?.ok&&room.phase==="over")recordShow();}
  if(event==="again")res=game.resetToLobby(room,playerId);
  if(event==="tick"){const changed=game.checkTimerExpired(room,Date.now());res={ok:true,changed};}
  if(res?.ok){if(res.usedIds){markUsedIds(res.usedIds);renderHistoryReset();}push();} return res||{ok:false,error:"Unknown action"};
}
async function act(event,payload){const res=isHost?handle(myId,event,payload):await net.send(event,payload);if(!res?.ok)toast(res?.error||"That didn't work.");return res;}

async function create(){unlockAudio();const settings=readSettings();if(!settings.spectatorHost&&!settings.name.trim())return toast("Enter your name.");$("create-btn").disabled=true;try{isHost=true;myId=HOST_ID;net=await hostRoom({onMessage:handle,onPeerClose:(id)=>{game.disconnectPlayer(room,id);push()},onError:toast});room=game.createRoom(net.code,HOST_ID);if(!settings.spectatorHost){activeToken=createResumeToken();game.addPlayer(room,HOST_ID,settings.name,activeToken);}state=game.toPublicState(room,myId);render();}catch(e){toast(e.message);isHost=false;}finally{$("create-btn").disabled=false}}
async function join(){unlockAudio();const code=normalizeCode($("code-input").value),name=$("name-input").value.trim();if(code.length!==4||!name)return toast("Enter your name and 4-character room code.");try{isHost=false;const saved=loadSession(code);activeToken=saved?.resumeToken||createResumeToken();net=await joinRoom(code,{onPush:(e,p)=>{if(e==="state")applyState(p)},onClose:toast});myId=net.id;const res=await net.send("join",{name,resumeToken:activeToken});if(!res.ok)throw new Error(res.error);saveSession(code,{resumeToken:activeToken,name});applyState(res.state);}catch(e){toast(e.message)}}
function readSettings(){const saved=loadSettings();return{...saved,name:$("name-input").value,spectatorHost:$("spectator-input").checked}}
function gameSettings(){return{categories:[...document.querySelectorAll("[data-category]:checked")].map((x)=>x.value),themes:[...document.querySelectorAll("[data-theme]:checked")].map((x)=>x.value),questionCount:Number($("count-select").value),timerSeconds:Number($("timer-select").value),revealAdvanceSeconds:Number($("advance-select").value)}}

const saved=loadSettings();$("name-input").value=saved.name||"";$("spectator-input").checked=saved.spectatorHost;
const savedCategories=Array.isArray(saved.categories)?saved.categories:[],savedThemes=Array.isArray(saved.themes)?saved.themes:[];
for(let i=6;i<=20;i++)$("count-select").add(new Option(`${i} rounds`,i));
for(const i of[30,40,50])$("count-select").add(new Option(`${i} rounds`,i));
function addCategoryChecks(categories,containerId){for(const c of categories){const count=QUESTIONS.filter((q)=>q.category===c).length;const label=document.createElement("label");const checked=savedCategories.includes(c)?" checked":"";label.innerHTML=`<input type="checkbox" data-category value="${c}"${checked}> ${c} (${count})`;$(containerId).appendChild(label)}}
addCategoryChecks(game.GENERAL_CATEGORIES,"general-category-list");addCategoryChecks(game.FILIPINO_CATEGORIES,"filipino-category-list");
for(const t of THEMES){const count=QUESTIONS.filter((q)=>q.theme===t).length;const label=document.createElement("label");const checked=savedThemes.includes(t)?" checked":"";label.innerHTML=`<input type="checkbox" data-theme value="${t}"${checked}> ${t} (${count})`;$("theme-list").appendChild(label)}
$("count-select").value=String(saved.questionCount);$("timer-select").value=String(saved.timerSeconds);$("advance-select").value=String(saved.revealAdvanceSeconds);
$("create-btn").onclick=create;$("join-btn").onclick=join;$("lock-btn").onclick=()=>act("answer",{answer:$("answer-input").value});
$("answer-input").oninput=(e)=>{answerDraft=e.target.value};
$("answer-input").onkeydown=(e)=>{if(e.key==="Enter")$("lock-btn").click()};
$("start-btn").onclick=()=>{const settings=gameSettings();if(!settings.categories.length&&!settings.themes.length)return toast("Choose at least one category or theme.");saveSettings({...readSettings(),...settings});act("start",{settings})};$("next-btn").onclick=()=>act("advance",{});$("again-btn").onclick=()=>act("again",{});$("reset-history-btn").onclick=()=>{const count=resetUsedIds();renderHistoryReset();toast(`${count} used question${count===1?"":"s"} can appear again.`)};
renderHistoryReset();
const queryCode=normalizeCode(new URLSearchParams(location.search).get("room"));if(queryCode.length===4)$("code-input").value=queryCode;
