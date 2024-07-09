import {
  createApp,
  reactive,
} from 'https://cdn.jsdelivr.net/npm/petite-vue@0.4.1/dist/petite-vue.es.js'

import { outlineToStr, parseOutlineStr, params, updateParams } from '../lib/shared.js'

const store = reactive({
  existingOutline: [],
  extractedOutline: [],
  editedOutline: [],
  outlineStr: '',
  paramsStr: JSON.stringify(params, null, 2),
  paramsStrDefault: JSON.stringify(params, null, 2),
  showOutlineTab: '',
  showModal: false,
  showParamMessage: false,
  docTitle: '',
  setEditedOutline() {
    this.editedOutline = parseOutlineStr(this.outlineStr)
    this.showModal = false
    this.showOutlineTab = 'edited'
  },
  toggleModal() {
    this.showModal=!this.showModal
    this.showParamMessage = false
  },
  async applyParams(){
    const newParams = JSON.parse(this.paramsStr)
    await window.viewer.extractOutline(newParams)
    this.showParamMessage = true
  },
  async resetParams() {
    this.paramsStr = this.paramsStrDefault
    const params = JSON.parse(this.paramsStr)
    await window.viewer.extractOutline(params)
    this.showParamMessage = true
  }
})

createApp({
  store,
}).mount()

window.store = store

document.getElementById('use-existing-button').addEventListener('click', () => {
  const textarea = document.querySelector('#outline-field > textarea')
  setTextAreaContent(textarea, outlineToStr(store.existingOutline))
})

document.getElementById('use-extracted-button').addEventListener('click', () => {
  const textarea = document.querySelector('#outline-field > textarea')
  setTextAreaContent(textarea, outlineToStr(store.extractedOutline))
})

function setTextAreaContent(textArea, newText) {
  textArea.select();
  document.execCommand("insertText", false, newText);
  // although deprecated, this allows undo, and no alternative seems to exist
}


// allow Tab input (otherwise it switches to next field)
document.querySelector('textarea').addEventListener("keydown", function (e) {
  if (e.key == "Tab") {
   e.preventDefault();
   document.execCommand("insertText", false, "\t");
 }
});

fetch('https://count.lnfinite.space/page/pdfoutliner?plus=1', {
  credentials: 'include',
})
