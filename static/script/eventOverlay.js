function isTopWindow() {
    try {
        return window.self === window.top;
    } catch (e) {
        return true;
    }
}

function navigateOverlayFrame(href) {
    var frame = document.getElementById('eventOverlayFrame');
    try {
        frame.contentWindow.location.replace(href);
    } catch (e) {
        frame.src = href;
    }
}

function openEventOverlay(href, pushState) {
    navigateOverlayFrame(href);
    $('#eventOverlay').addClass('open');
    $('body').addClass('block');
    $('main, footer, #startpageNav, #filters, #dayNav').addClass('blur');

    if (pushState !== false) {
        history.pushState({ eventOverlay: true, href: href }, '', href);
    }
}

function closeEventOverlay() {
    if (history.state && history.state.eventOverlay) {
        history.back();
    } else {
        hideEventOverlay();
    }
}

function hideEventOverlay() {
    $('#eventOverlay').removeClass('open');
    $('body').removeClass('block');
    $('main, footer, #startpageNav, #filters, #dayNav').removeClass('blur');
    navigateOverlayFrame('about:blank');
}

$(document).ready(function () {
    if (!isTopWindow()) return;

    $(document).on('click', 'a[href]', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

        var raw = this.getAttribute('href') || '';
        var match = raw.match(/events\/([^\/?#]+)(?:\/(de|en))?/);
        if (!match) return;

        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
            var linkOrigin;
            try {
                linkOrigin = new URL(raw).origin;
            } catch (err) {
                return;
            }
            if (linkOrigin !== window.location.origin) return;
        }

        var overlayUrl = window.location.origin + '/events/' + match[1] + (match[2] ? '/' + match[2] : '');

        e.preventDefault();
        openEventOverlay(overlayUrl);
    });

    $('#eventOverlay').on('click', function (e) {
        if (e.target === this) closeEventOverlay();
    });

    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.eventOverlay) {
            openEventOverlay(e.state.href, false);
        } else {
            hideEventOverlay();
        }
    });
});
