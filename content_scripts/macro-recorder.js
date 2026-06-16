function getSelectorFromPath(event) {
	const path = event.composedPath();
	const selectorParts = [];

	for (let i = 0; i < path.length; i++) {
		const node = path[i];

		if (!node || node.nodeType !== Node.ELEMENT_NODE) {
			continue;
		}

		let part = node.tagName.toLowerCase();

		if (node.id) {
			part += `#${node.id}`;
			selectorParts.push(part);
			break;
		} 
		else if (node.classList && node.classList.length > 0) {
			part += `.${Array.from(node.classList).join('.')}`;
		}

		selectorParts.push(part);
	}

	return selectorParts.join(' > ');
}

const sendClickEvent = (e) => {
	let path = getSelectorFromPath(e)
	let payload = { action: "event", path, event: "click" }
	browser.runtime.sendMessage(payload)
}

const sendKeypressEvent = (e) => {
	let key = e.key;
	let modifiers = [];
	if (e.ctrlKey)
		modifiers.push("ctrl")
	if (e.shiftKey)
		modifiers.push("shift")
	if (e.altKey)
		modifiers.push("alt")
	if (e.metaKey)
		modifiers.push("meta")
	let payload = {action: "event", key, modifiers, event: "keypress"}
	browser.runtime.sendMessage(payload)
}

(async function() {
	browser.runtime.onMessage.addListener(async (message, sender)=>{
		if (message.action == "start") {
			document.addEventListener('click', sendClickEvent)
			document.addEventListener("keypress", sendKeypressEvent)
			document.body.classList.toggle("recording")
		}
		if (message.action == "stop") {
			document.removeEventListener('click', sendClickEvent)
			document.removeEventListener("keypress", sendKeypressEvent)
			document.body.classList.toggle("recording")
		}
	})
})();
