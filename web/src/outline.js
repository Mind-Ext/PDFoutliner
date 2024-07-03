import {
  createApp,
  reactive,
} from 'https://cdn.jsdelivr.net/npm/petite-vue@0.4.1/dist/petite-vue.es.js'

const store = reactive({
  existingOutline: [],
  extractedOutline: [],
  showExtracted: true,
  docTitle: '',
})

createApp({
  store,
}).mount()

window.store = store

fetch('https://count.lnfinite.space/page/pdfoutliner?plus=1', {
  credentials: 'include',
})
  .then((res) => res.text())
  .then((text) => console.log(text))
