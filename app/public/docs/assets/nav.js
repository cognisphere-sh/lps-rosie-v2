// LPS handbook navigation. One manifest drives the sidebar, prev/next links
// and the per-page table of contents, so pages only carry their own content.
// Static files under /docs/*.html bypass the app's login gate (proxy.ts
// matcher skips any path with a file extension), so this handbook is public.
;(function () {
  var SECTIONS = [
    {
      title: 'Start here',
      pages: [
        ['index.html', 'Handbook home'],
        ['overview.html', 'What LPS is and who uses it'],
      ],
    },
    {
      title: 'Business workflows',
      pages: [
        ['workflow-end-to-end.html', 'Quote to order, end to end'],
        ['jobs.html', 'Jobs and job lines'],
        ['availability-requests.html', 'Availability requests'],
        ['orders.html', 'Supplier orders'],
        ['supplier-portal.html', 'Supplier portal and public links'],
        ['catalogue.html', 'Suppliers, plants and catalogue'],
        ['agents-overview.html', 'Meet the agents'],
      ],
    },
    {
      title: 'System design',
      pages: [
        ['architecture.html', 'Architecture'],
        ['lifecycles.html', 'Status lifecycles'],
        ['frontend.html', 'Frontend: routes and components'],
        ['auth-security.html', 'Auth, roles and security'],
        ['chat-realtime.html', 'Chat and live updates'],
      ],
    },
    {
      title: 'Reference',
      pages: [
        ['api-reference.html', 'API reference'],
        ['database.html', 'Database schema'],
        ['harness-agents.html', 'Agents (technical)'],
        ['plugins.html', 'Harness plugins'],
        ['operations.html', 'Deployment and operations'],
        ['glossary.html', 'Glossary'],
      ],
    },
  ]

  var here = location.pathname.split('/').pop() || 'index.html'
  var flat = []
  SECTIONS.forEach(function (s) {
    s.pages.forEach(function (p) {
      flat.push(p)
    })
  })

  function el(tag, attrs, text) {
    var n = document.createElement(tag)
    for (var k in attrs || {}) n.setAttribute(k, attrs[k])
    if (text != null) n.textContent = text
    return n
  }

  function buildSidebar() {
    var nav = el('nav', { class: 'side', 'aria-label': 'Handbook' })
    var brand = el('a', { class: 'brand', href: 'index.html' })
    brand.appendChild(el('img', { src: '../lps-cactus-icon-192.png', alt: '' }))
    brand.appendChild(el('span', null, 'LPS Handbook'))
    nav.appendChild(brand)
    SECTIONS.forEach(function (s) {
      nav.appendChild(el('p', { class: 'side-title' }, s.title))
      var ul = el('ul')
      s.pages.forEach(function (p) {
        var li = el('li')
        var a = el('a', { href: p[0] }, p[1])
        if (p[0] === here) a.setAttribute('aria-current', 'page')
        li.appendChild(a)
        ul.appendChild(li)
      })
      nav.appendChild(ul)
    })
    return nav
  }

  function buildToc(main) {
    var heads = main.querySelectorAll('h2[id]')
    if (heads.length < 2) return null
    var toc = el('nav', { class: 'toc', 'aria-label': 'On this page' })
    toc.appendChild(el('p', { class: 'side-title' }, 'On this page'))
    var ul = el('ul')
    heads.forEach(function (h) {
      var li = el('li')
      li.appendChild(el('a', { href: '#' + h.id }, h.textContent))
      ul.appendChild(li)
    })
    toc.appendChild(ul)
    return toc
  }

  function buildPager() {
    var i = flat.findIndex(function (p) {
      return p[0] === here
    })
    if (i < 0) return null
    var pager = el('nav', { class: 'pager', 'aria-label': 'Previous and next page' })
    if (i > 0) {
      var prev = el('a', { href: flat[i - 1][0], class: 'prev' })
      prev.appendChild(el('small', null, 'Previous'))
      prev.appendChild(el('span', null, flat[i - 1][1]))
      pager.appendChild(prev)
    }
    if (i < flat.length - 1) {
      var next = el('a', { href: flat[i + 1][0], class: 'next' })
      next.appendChild(el('small', null, 'Next'))
      next.appendChild(el('span', null, flat[i + 1][1]))
      pager.appendChild(next)
    }
    return pager
  }

  document.addEventListener('DOMContentLoaded', function () {
    var main = document.querySelector('main.doc')
    if (!main) return
    var shell = el('div', { class: 'shell' })
    var toggle = el('button', { class: 'menu-toggle', type: 'button', 'aria-expanded': 'false' }, 'Menu')
    var side = buildSidebar()
    toggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open')
      toggle.setAttribute('aria-expanded', String(open))
    })
    main.parentNode.insertBefore(shell, main)
    shell.appendChild(side)
    shell.appendChild(main)
    var toc = buildToc(main)
    if (toc) shell.appendChild(toc)
    var pager = buildPager()
    if (pager) main.appendChild(pager)
    document.body.insertBefore(toggle, shell)
  })
})()
