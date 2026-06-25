import * as $ from "./jquery.js"
let step_list = document.getElementById("step-list")
let helpful = document.getElementById("helpful")
let no_interactions = document.getElementById("no-interactions")
let sidebar = document.getElementById("sidebar-content")
let record = document.getElementById("record")
let save = document.getElementById("save")
let discard = document.getElementById("discard")
let popup = document.getElementById("popup-prompt")
let popup_save = popup.querySelector("#popup-save")
let popup_discard = popup.querySelector("#popup-discard")
let stop = document.getElementById("stop")
let list = document.getElementById("list")
let macro_title = document.getElementById("macro-title")
let macro_list = document.getElementById("macro-list")
let no_macros = document.getElementById("no-macros")

class Recorder {
	constructor () {
		this.current = null
		this.macros = []
		this.recording = false
	}

	async record() {
		if (!this.recording) {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
			this.current = new Macro()
			this.current.title = 'Untitled'
			this.recording = true
			await browser.tabs.sendMessage(tab.id, {action: "start"})
			let result = await browser.storage.local.get("macros")
			if (Object.keys(result).length != 0)
				this.macros = result.macros
			let i = 1;
			while (this.macros.findIndex(m=>m.title == this.current.title)>=0)
				this.current.title = `Untitled-${i++}`
		}
	}

	async stop() {
		if (this.recording) {
			const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
			this.current.href = tab.url
			await browser.tabs.sendMessage(tab.id, {action: "stop"})
			this.recording = false
		}
	}

	async save() {
		if (this.current.steps.length != 0 || macro_title.value != this.current.title) {
			if (this.macros.length == 0) {
				let result = await browser.storage.local.get("macros")
				if (Object.keys(result).length != 0)
					this.macros = result.macros
			}
			await browser.storage.local.set({
				macros: [...this.macros, this.current]
			})
		}
		this.clear()
	}

	clear() {
		this.current = null
	}

	async load() {
		let result = await browser.storage.local.get("macros")
		if (Object.keys(result).length != 0)
			this.macros = result.macros
	}

	static async injectScripts(tabId) {
		await browser.scripting.executeScript({
			target: { tabId },
			files: ["/content_scripts/macro-recorder.js"],
		});
		await browser.scripting.insertCSS({
			target: { tabId },
			files: ["/content_scripts/macro-recorder.css"],
		});
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
}

let recorder = new Recorder()

function show(element) {
	if (element.classList.contains("hidden"))
		element.classList.remove("hidden")
}

function hide(element) {
	if (!element.classList.contains("hidden"))
		element.classList.add("hidden")
}

function isShown(element) {
	return !element.classList.contains("hidden")
}

browser.storage.local.remove("macros")
function clear(element, selector) {
	let children = element.querySelectorAll(selector)
	for (let child of children)
		child.remove()
}

function startRecording() {
	recorder.record().then(() => {
		show(step_list)
		hide(macro_list)
		show(stop)
		hide(record)
		hide(helpful)
		show(no_interactions)
		macro_title.value = recorder.current.title
	})
}

function stopRecording() {
	recorder.stop().then(()=>{
		hide(stop)
		show(save)
		show(discard)
	})
}

function saveMacro(is_popup) {
	return () => {
		recorder.save().then(()=>{
			if (is_popup)
				popup.close()
			clear(step_list, ".step-item")
			clear(macro_list, ".macro-item")
			hide(save)
			hide(discard)
			show(record)
			listMacros()
			macro_title.value = ""
		})
	}
}

function discardMacro(is_popup) {
	return () => {
		recorder.clear()
		if (!is_popup)
			popup.close()
		clear(step_list, ".step-item")
		hide(discard)
		hide(save)
		show(record)
		show(helpful)
		macro_title.value = ""
	}
}

const popupSaveMacro = saveMacro(true)
const popupDiscardMacro = discardMacro(true)

function openPopup() {
	popup.showModal()
	popup_save.addEventListener("click", popupSaveMacro)
	popup_discard.addEventListener("click", popupDiscardMacro)
	popup.addEventListener('click', closePopup)
}

function closePopup(e) {
	const dialogDimensions = popup.getBoundingClientRect();
	if (
		e.clientX < dialogDimensions.left ||
			e.clientX > dialogDimensions.right ||
			e.clientY < dialogDimensions.top ||
			e.clientY > dialogDimensions.bottom
	) {
		popup.close();
	}
}

function listMacros() {
	if (recorder.current) {
		openPopup()
		return
	}
	hide(step_list)
	show(macro_list)
	clear(macro_list, ".macro-item")
	recorder.load().then(() => {
		for (let i=0; i<recorder.macros.length; i++) {
			let macro = document.createElement("li")
			macro.classList.add("macro-item")
			macro.innerText = recorder.macros[i].title
			let play = document.createElement("button")
			play.innerHTML = '&#x25B6;'
			play.addEventListener("click", (e)=>{
				recorder.macros[i].play()
			})
			macro.append(play)
			macro_list.append(macro)
		}
		if (recorder.macros.length == 0)
			show(no_macros)
		else
			hide(no_macros)
	})
}

function captureSteps(message) {
	console.log(message)
	if (recorder.recording && recorder.current.steps.length == 0) {
		hide(no_interactions)
	}
	let step = document.createElement("p")
	if (message.event == "click")
		step.innerText = `${message.event} ${message.path}`
	if (message.event == "keypress")
	{
		let modifiers = message.modifiers.reduce((acc,m)=> acc += m[0].toUpper() + m.slice(1) + "+","")
		step.innerText = `${message.event} ${modifiers + message.key}`
	}
	if (message.event == "url-change") {
		if (recorder.current.steps[recorder.current.steps.length - 1] && message.href != recorder.current.steps[recorder.current.steps.length - 1].href && message.href != recorder.current.href)
			step.innerText = `${message.event} ${message.href}`
	}
	if (message.event == "tab-change") {
		step.innerText = `${message.event} ${message.href}`
	}
	step.classList.add("step-item")
	step_list.append(step)
	recorder.current.steps.push(message)
}

(async function runOnSidebarOpened() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    
	await Recorder.injectScripts(tab.id)

	browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tabInfo) => {
		if (tabId == tab.id) {
			await Recorder.injectScript(tab.id)
		}
		if (changeInfo.url != tab.url && recorder.recording) {
			await browser.tabs.sendMessage(tab.id, {action: "url-change"});
		}
	});

	browser.tabs.onActivated.addListener(async (activeInfo) => {
		if (recorder.recording) {
			await Recorder.injectScript(activeInfo.tabId)
			await browser.tabs.sendMessage(activeInfo.tabId, {action: "tab-change"})
		}
	})

	record.addEventListener("click", startRecording)

	stop.addEventListener("click", stopRecording)

	list.addEventListener("click", listMacros)

	save.addEventListener("click", saveMacro(false))

	discard.addEventListener("click", discardMacro(false))

	browser.runtime.onMessage.addListener((message)=>{
		if (recorder.recording) {
			if (message.action == "event") {
				captureSteps(message);
			}
		}
	})
})();
