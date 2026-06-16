import * as $ from "./jquery.js"
let step_list = document.getElementById("step-list")
let helpful = document.getElementById("helpful")
let no_interactions = document.getElementById("no-interactions")
let sidebar = document.getElementById("sidebar-content")
let record = document.getElementById("record")
let save = document.getElementById("save")
let discard = document.getElementById("discard")
let stop = document.getElementById("stop")
let list = document.getElementById("list")
let macro_title = document.getElementById("macro-title")
let macro_list = document.getElementById("macro-list")

class Recorder() {
	constructor () {
		this.current = new Macro()
		this.macros = []
	}
}

class Macro {
	constructor({title = '', href = '', steps = []} = {}) {
		this.title = title
		this.href = href
		this.steps = steps
	}
	
	play() {
		console.log("macro playing...")
	}

	record() {}
}

let currentMacro = new Macro()

browser.storage.local.remove("macros")
function clearRecording() {
	let steps = step_list.querySelectorAll(".step-item")
	steps.forEach(s=>s.remove())
	macro_title.value = currentMacro.title
	if (!macro_list.classList.contains("hidden"))
		macro_list.classList.toggle("hidden")
	if (!no_interactions.classList.contains("hidden"))
		no_interactions.classList.toggle("hidden")
	if (helpful.classList.contains("hidden"))
		helpful.classList.toggle("hidden")
}

function startRecording(tab) {
	return () => {
		currentMacro.title = 'Untitled'
		clearRecording()
		stop.classList.toggle("hidden")
		record.classList.toggle("hidden")
		helpful.classList.toggle("hidden")
		no_interactions.classList.toggle("hidden")
		browser.tabs.sendMessage(tab.id, {action: "start"})
		browser.storage.local.get("macros").then(result => {
			let macros = []
			if (Object.keys(result).length != 0)
				macros = result.macros
			let i = 0;
			while (macros.findIndex(m=>m.title == currentMacro.title)>=0) {
				i++;
				currentMacro.title = `Untitled-${i}`
			}
			macro_title.value = currentMacro.title
		})
	}
}

function stopRecording(tab) {
	currentMacro.href = tab.url
	return () => {
		browser.tabs.sendMessage(tab.id, {action: "stop"})
		browser.storage.local.get("macros").then(result=>{
			let macros = []
			if (Object.keys(result).length != 0)
				macros = result.macros
			browser.storage.local.set({
				macros: [...macros, currentMacro]
			}).then(()=>console.log("Macro Saved"))
		})
		stop.classList.toggle("hidden")
		record.classList.toggle("hidden")
	}
}

function listMacros() {
	if (!stop.classList.contains("hidden"))
	{

	}
	macro_list.classList.toggle("hidden")
	step_list.classList.toggle("hidden")
	browser.storage.local.get("macros").then(result => {
		let macros = []
		if (Object.keys(result).length != 0)
			macros = result.macros
		for (let i=0; i<macros.length; i++) {
			let macro = document.createElement("li")
			macro.classList.add("macro-item")
			macro.innerText = macros[i].title
			let play = document.createElement("button")
			play.innerHTML = '&#x25B6;'
			play.addEventListener("click", (e)=>{
				let _m = new Macro(macros[i].title, macros[i].href, macros[i].steps)
				_m.play()
			})
			macro.append(play)
			macro_list.append(macro)
		}
	})
}

function captureSteps(message) {
	if (currentMacro.steps.length == 0) {
		no_interactions.classList.toggle("hidden")
	}
	let step = document.createElement("p")
	if (message.event == "click")
		step.innerText = `${message.event} ${message.path}`
	if (message.event == "keypress")
	{
		let modifiers = message.modifiers.reduce((acc,m)=> acc += m[0].toUpper() + m.slice(1) + "+","")
		step.innerText = `${message.event} ${modifiers + message.key}`
	}
	step.classList.add("step-item")
	step_list.append(step)
	currentMacro.steps.push(message)
}

(async function runOnSidebarOpened() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/content_scripts/macro-recorder.js"],
    });
    await browser.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["/content_scripts/macro-recorder.css"],
    });

	record.addEventListener("click", startRecording(tab))

	stop.addEventListener("click", stopRecording(tab))

	list.addEventListener("click", listMacros)

	browser.runtime.onMessage.addListener((message)=>{
		if (message.action == "event") {
			captureSteps(message);
		}
	})
})();
