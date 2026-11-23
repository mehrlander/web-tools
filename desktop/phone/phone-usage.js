/* One phone Usage view: current allowances, aligned history, and recent Claude context. */
(() => {
 'use strict';
 // Tailwind descendant utilities retain the shared calendar geometry and states.
 const usageUtilities=[
  // .pu-shell
  "[&.pu-shell]:[color:rgb(41,_37,_36)]!", "[&.pu-shell]:[font-family:inherit]!", "[&.pu-shell]:[min-width:0px]!", "[&.pu-shell]:[padding-top:0px]!", "[&.pu-shell]:[padding-right:0px]!", "[&.pu-shell]:[padding-bottom:12px]!", "[&.pu-shell]:[padding-left:0px]!", "[&.pu-shell]:[padding:0px_0px_12px]!",
  // .pu-shell button
  "[&.pu-shell_button]:[font-family:inherit]!",
  // .pu-current
  "[&_.pu-current]:[padding-top:10px]", "[&_.pu-current]:[padding-right:12px]", "[&_.pu-current]:[padding-bottom:12px]", "[&_.pu-current]:[padding-left:12px]", "[&_.pu-current]:[padding:10px_12px_12px]",
  // .pu-current>h2
  "[&_.pu-current>h2]:[margin-top:0px]", "[&_.pu-current>h2]:[margin-right:0px]", "[&_.pu-current>h2]:[margin-bottom:8px]", "[&_.pu-current>h2]:[margin-left:0px]", "[&_.pu-current>h2]:[margin:0px_0px_8px]", "[&_.pu-current>h2]:[font-size:11px]", "[&_.pu-current>h2]:[font-weight:550]", "[&_.pu-current>h2]:[color:rgb(120,_113,_108)]",
  // .pu-accounts
  "[&_.pu-accounts]:[display:grid]", "[&_.pu-accounts]:[grid-template-columns:repeat(3,minmax(0,1fr))]", "[&_.pu-accounts]:[gap:8px]",
  // .pu-account
  "[&_.pu-account]:[display:flex]", "[&_.pu-account]:[flex-direction:column]", "[&_.pu-account]:[gap:5px]", "[&_.pu-account]:[min-width:0px]", "[&_.pu-account]:[padding-top:8px]", "[&_.pu-account]:[padding-right:8px]", "[&_.pu-account]:[padding-bottom:8px]", "[&_.pu-account]:[padding-left:8px]", "[&_.pu-account]:[padding:8px]", "[&_.pu-account]:[text-align:left]", "[&_.pu-account]:[border:1px_solid_rgb(230,_227,_222)]", "[&_.pu-account]:[border-width:1px]", "[&_.pu-account]:[border-style:solid]", "[&_.pu-account]:[border-color:rgb(230,_227,_222)]", "[&_.pu-account]:[border-top:1px_solid_rgb(230,_227,_222)]", "[&_.pu-account]:[border-top-width:1px]", "[&_.pu-account]:[border-top-style:solid]", "[&_.pu-account]:[border-top-color:rgb(230,_227,_222)]", "[&_.pu-account]:[border-right:1px_solid_rgb(230,_227,_222)]", "[&_.pu-account]:[border-right-width:1px]", "[&_.pu-account]:[border-right-style:solid]", "[&_.pu-account]:[border-right-color:rgb(230,_227,_222)]", "[&_.pu-account]:[border-bottom:1px_solid_rgb(230,_227,_222)]", "[&_.pu-account]:[border-bottom-width:1px]", "[&_.pu-account]:[border-bottom-style:solid]", "[&_.pu-account]:[border-bottom-color:rgb(230,_227,_222)]", "[&_.pu-account]:[border-left:1px_solid_rgb(230,_227,_222)]", "[&_.pu-account]:[border-left-width:1px]", "[&_.pu-account]:[border-left-style:solid]", "[&_.pu-account]:[border-left-color:rgb(230,_227,_222)]", "[&_.pu-account]:[border-image:none]", "[&_.pu-account]:[border-radius:9px]", "[&_.pu-account]:[background-image:none]", "[&_.pu-account]:[background-position:0%_0%]", "[&_.pu-account]:[background-size:auto]", "[&_.pu-account]:[background-repeat:repeat]", "[&_.pu-account]:[background-origin:padding-box]", "[&_.pu-account]:[background-clip:border-box]", "[&_.pu-account]:[background-attachment:scroll]", "[&_.pu-account]:[background-color:rgb(255,_255,_255)]", "[&_.pu-account]:[background:rgb(255,_255,_255)]", "[&_.pu-account]:[color:rgb(68,_64,_60)]",
  // .pu-account:focus-visible
  "[&_.pu-account:focus-visible]:[outline:2px_solid_var(--account-color)]", "[&_.pu-account:focus-visible]:[outline-offset:2px]",
  // .pu-account:hover
  "[&_.pu-account:hover]:[background-image:none]", "[&_.pu-account:hover]:[background-position:0%_0%]", "[&_.pu-account:hover]:[background-size:auto]", "[&_.pu-account:hover]:[background-repeat:repeat]", "[&_.pu-account:hover]:[background-origin:padding-box]", "[&_.pu-account:hover]:[background-clip:border-box]", "[&_.pu-account:hover]:[background-attachment:scroll]", "[&_.pu-account:hover]:[background-color:rgb(250,_249,_247)]", "[&_.pu-account:hover]:[background:rgb(250,_249,_247)]",
  // .pu-account-name
  "[&_.pu-account-name]:[display:flex]", "[&_.pu-account-name]:[align-items:center]", "[&_.pu-account-name]:[gap:5px]", "[&_.pu-account-name]:[font-size:13px]", "[&_.pu-account-name]:[font-weight:600]", "[&_.pu-account-name]:[white-space:nowrap]", "[&_.pu-account-name]:[color:var(--account-color)]",
  // .pu-account .brand
  "[&_.pu-account_.brand]:[width:16px]", "[&_.pu-account_.brand]:[height:16px]", "[&_.pu-account_.brand]:[flex-grow:0]", "[&_.pu-account_.brand]:[flex-shrink:0]", "[&_.pu-account_.brand]:[flex-basis:auto]", "[&_.pu-account_.brand]:[flex:0_0_auto]",
  // .pu-account-value
  "[&_.pu-account-value]:[display:flex]", "[&_.pu-account-value]:[align-items:baseline]", "[&_.pu-account-value]:[gap:4px]", "[&_.pu-account-value]:[font-size:20px]", "[&_.pu-account-value]:[line-height:24px]", "[&_.pu-account-value]:[font-weight:600]", "[&_.pu-account-value]:[font-variant-numeric:tabular-nums]",
  // .pu-account-value small
  "[&_.pu-account-value_small]:[font-size:10px]", "[&_.pu-account-value_small]:[font-weight:400]", "[&_.pu-account-value_small]:[color:rgb(138,_129,_118)]",
  // .pu-account .quota-bar
  "[&_.pu-account_.quota-bar]:[display:block]", "[&_.pu-account_.quota-bar]:[align-self:stretch]", "[&_.pu-account_.quota-bar]:[height:4px]", "[&_.pu-account_.quota-bar]:[margin-top:0px]", "[&_.pu-account_.quota-bar]:[margin-right:0px]", "[&_.pu-account_.quota-bar]:[margin-bottom:2px]", "[&_.pu-account_.quota-bar]:[margin-left:0px]", "[&_.pu-account_.quota-bar]:[margin:0px_0px_2px]",
  // .pu-account .quota-bar .elapsed
  "[&_.pu-account_.quota-bar_.elapsed]:[height:8px]",
  // .pu-reset-date
  "[&_.pu-reset-date]:[font-size:11px]", "[&_.pu-reset-date]:[line-height:15px]", "[&_.pu-reset-date]:[white-space:nowrap]", "[&_.pu-reset-date]:[color:rgb(87,_83,_78)]",
  // .pu-reset-left
  "[&_.pu-reset-left]:[font-size:10px]", "[&_.pu-reset-left]:[line-height:13px]", "[&_.pu-reset-left]:[white-space:nowrap]", "[&_.pu-reset-left]:[color:rgb(138,_129,_118)]",
  // .pu-account.is-stale .pu-account-value
  "[&_.pu-account.is-stale_.pu-account-value]:[color:rgb(138,_129,_118)]",
  // .pu-account.is-stale .fill
  "[&_.pu-account.is-stale_.fill]:[background-image:none]", "[&_.pu-account.is-stale_.fill]:[background-position:0%_0%]", "[&_.pu-account.is-stale_.fill]:[background-size:auto]", "[&_.pu-account.is-stale_.fill]:[background-repeat:repeat]", "[&_.pu-account.is-stale_.fill]:[background-origin:padding-box]", "[&_.pu-account.is-stale_.fill]:[background-clip:border-box]", "[&_.pu-account.is-stale_.fill]:[background-attachment:scroll]", "[&_.pu-account.is-stale_.fill]:[background-color:rgb(168,_162,_158)]", "[&_.pu-account.is-stale_.fill]:[background:rgb(168,_162,_158)]",
  // .pu-shell .usage-workspace
  "[&.pu-shell_.usage-workspace]:[gap:0px]!", "[&.pu-shell_.usage-workspace]:[padding-top:0px]!", "[&.pu-shell_.usage-workspace]:[padding-right:0px]!", "[&.pu-shell_.usage-workspace]:[padding-bottom:0px]!", "[&.pu-shell_.usage-workspace]:[padding-left:0px]!", "[&.pu-shell_.usage-workspace]:[padding:0px]!",
  // .pu-shell .usage-workspace-timeline
  "[&.pu-shell_.usage-workspace-timeline]:[padding-top:0px]!", "[&.pu-shell_.usage-workspace-timeline]:[padding-right:12px]!", "[&.pu-shell_.usage-workspace-timeline]:[padding-bottom:5px]!", "[&.pu-shell_.usage-workspace-timeline]:[padding-left:12px]!", "[&.pu-shell_.usage-workspace-timeline]:[padding:0px_12px_5px]!",
  // .pu-shell .usage-calendar
  "[&.pu-shell_.usage-calendar]:[--calendar-row:70px]!", "[&.pu-shell_.usage-calendar]:[padding-top:0px]!", "[&.pu-shell_.usage-calendar]:[padding-right:0px]!", "[&.pu-shell_.usage-calendar]:[padding-bottom:0px]!", "[&.pu-shell_.usage-calendar]:[padding-left:0px]!", "[&.pu-shell_.usage-calendar]:[padding:0px]!",
  // .pu-shell .history-rail-tools
  "[&.pu-shell_.history-rail-tools]:[min-height:30px]!",
  // .pu-shell .history-fixed
  "[&.pu-shell_.history-fixed]:[background-image:none]!", "[&.pu-shell_.history-fixed]:[background-position:0%_0%]!", "[&.pu-shell_.history-fixed]:[background-size:auto]!", "[&.pu-shell_.history-fixed]:[background-repeat:repeat]!", "[&.pu-shell_.history-fixed]:[background-origin:padding-box]!", "[&.pu-shell_.history-fixed]:[background-clip:border-box]!", "[&.pu-shell_.history-fixed]:[background-attachment:scroll]!", "[&.pu-shell_.history-fixed]:[background-color:rgb(245,_245,_244)]!", "[&.pu-shell_.history-fixed]:[background:rgb(245,_245,_244)]!",
  // .pu-shell .calendar-pace
  "[&.pu-shell_.calendar-pace]:[border:0px]!", "[&.pu-shell_.calendar-pace]:[border-width:0px]!", "[&.pu-shell_.calendar-pace]:[border-style:none]!", "[&.pu-shell_.calendar-pace]:[border-color:currentcolor]!", "[&.pu-shell_.calendar-pace]:[border-top:0px]!", "[&.pu-shell_.calendar-pace]:[border-top-width:0px]!", "[&.pu-shell_.calendar-pace]:[border-top-style:none]!", "[&.pu-shell_.calendar-pace]:[border-top-color:currentcolor]!", "[&.pu-shell_.calendar-pace]:[border-right:0px]!", "[&.pu-shell_.calendar-pace]:[border-right-width:0px]!", "[&.pu-shell_.calendar-pace]:[border-right-style:none]!", "[&.pu-shell_.calendar-pace]:[border-right-color:currentcolor]!", "[&.pu-shell_.calendar-pace]:[border-bottom:0px]!", "[&.pu-shell_.calendar-pace]:[border-bottom-width:0px]!", "[&.pu-shell_.calendar-pace]:[border-bottom-style:none]!", "[&.pu-shell_.calendar-pace]:[border-bottom-color:currentcolor]!", "[&.pu-shell_.calendar-pace]:[border-left:0px]!", "[&.pu-shell_.calendar-pace]:[border-left-width:0px]!", "[&.pu-shell_.calendar-pace]:[border-left-style:none]!", "[&.pu-shell_.calendar-pace]:[border-left-color:currentcolor]!", "[&.pu-shell_.calendar-pace]:[border-image:none]!", "[&.pu-shell_.calendar-pace]:[background-image:none]!", "[&.pu-shell_.calendar-pace]:[background-position:0%_0%]!", "[&.pu-shell_.calendar-pace]:[background-size:auto]!", "[&.pu-shell_.calendar-pace]:[background-repeat:repeat]!", "[&.pu-shell_.calendar-pace]:[background-origin:padding-box]!", "[&.pu-shell_.calendar-pace]:[background-clip:border-box]!", "[&.pu-shell_.calendar-pace]:[background-attachment:scroll]!", "[&.pu-shell_.calendar-pace]:[background-color:transparent]!", "[&.pu-shell_.calendar-pace]:[background:transparent]!",
  // .pu-shell .history-rail-scroll
  "[&.pu-shell_.history-rail-scroll]:[overscroll-behavior-x:contain]!", "[&.pu-shell_.history-rail-scroll]:[touch-action:pan-x_pan-y]!",
  // .pu-shell .history-label-leader
  "[&.pu-shell_.history-label-leader]:[position:absolute]!", "[&.pu-shell_.history-label-leader]:[left:50%]!", "[&.pu-shell_.history-label-leader]:[top:28px]!", "[&.pu-shell_.history-label-leader]:[height:1px]!", "[&.pu-shell_.history-label-leader]:[background-image:none]!", "[&.pu-shell_.history-label-leader]:[background-position:0%_0%]!", "[&.pu-shell_.history-label-leader]:[background-size:auto]!", "[&.pu-shell_.history-label-leader]:[background-repeat:repeat]!", "[&.pu-shell_.history-label-leader]:[background-origin:padding-box]!", "[&.pu-shell_.history-label-leader]:[background-clip:border-box]!", "[&.pu-shell_.history-label-leader]:[background-attachment:scroll]!", "[&.pu-shell_.history-label-leader]:[background-color:currentcolor]!", "[&.pu-shell_.history-label-leader]:[background:currentcolor]!", "[&.pu-shell_.history-label-leader]:[opacity:0.35]!", "[&.pu-shell_.history-label-leader]:[transform-origin:0_50%]!", "[&.pu-shell_.history-label-leader]:[pointer-events:none]!", "[&.pu-shell_.history-label-leader]:[z-index:-1]!",
  // .pu-shell .history-rail-legend
  "[&.pu-shell_.history-rail-legend]:[display:flex]!", "[&.pu-shell_.history-rail-legend]:[align-items:center]!", "[&.pu-shell_.history-rail-legend]:[gap:4px]!", "[&.pu-shell_.history-rail-legend]:[color:rgb(120,_113,_108)]!", "[&.pu-shell_.history-rail-legend]:[font-size:10px]!", "[&.pu-shell_.history-rail-legend]:[white-space:nowrap]!",
  // .pu-shell .history-rail-legend svg
  "[&.pu-shell_.history-rail-legend_svg]:[width:13px]!", "[&.pu-shell_.history-rail-legend_svg]:[height:13px]!",
  // .pu-shell .legend-recorded
  "[&.pu-shell_.legend-recorded]:[display:inline-flex]!", "[&.pu-shell_.legend-recorded]:[width:13px]!", "[&.pu-shell_.legend-recorded]:[height:13px]!",
  // .pu-shell .legend-recorded svg
  "[&.pu-shell_.legend-recorded_svg]:[width:13px]!", "[&.pu-shell_.legend-recorded_svg]:[height:13px]!",
  // .pu-shell .calendar-footer svg
  "[&.pu-shell_.calendar-footer_svg]:[width:13px]!", "[&.pu-shell_.calendar-footer_svg]:[height:13px]!",
  // .pu-shell .calendar-coverage svg
  "[&.pu-shell_.calendar-coverage_svg]:[width:13px]!", "[&.pu-shell_.calendar-coverage_svg]:[height:13px]!",
  // .pu-saved
  "[&_.pu-saved]:[margin-top:5px]", "[&_.pu-saved]:[margin-right:0px]", "[&_.pu-saved]:[margin-bottom:0px]", "[&_.pu-saved]:[margin-left:0px]", "[&_.pu-saved]:[margin:5px_0px_0px]", "[&_.pu-saved]:[color:rgb(161,_98,_7)]", "[&_.pu-saved]:[font-size:10px]",
  // (max-width:350px) .pu-accounts
  "[@media(max-width:350px)]:[&_.pu-accounts]:[gap:5px]",
  // (max-width:350px) .pu-account
  "[@media(max-width:350px)]:[&_.pu-account]:[padding-top:7px]", "[@media(max-width:350px)]:[&_.pu-account]:[padding-right:5px]", "[@media(max-width:350px)]:[&_.pu-account]:[padding-bottom:7px]", "[@media(max-width:350px)]:[&_.pu-account]:[padding-left:5px]", "[@media(max-width:350px)]:[&_.pu-account]:[padding:7px_5px]",
  // (max-width:350px) .pu-account-name
  "[@media(max-width:350px)]:[&_.pu-account-name]:[gap:4px]", "[@media(max-width:350px)]:[&_.pu-account-name]:[font-size:12px]",
  // (max-width:350px) .pu-account .brand
  "[@media(max-width:350px)]:[&_.pu-account_.brand]:[width:14px]", "[@media(max-width:350px)]:[&_.pu-account_.brand]:[height:14px]",
  // (max-width:350px) .pu-reset-date
  "[@media(max-width:350px)]:[&_.pu-reset-date]:[font-size:10px]",
  // (max-width:350px) .pu-reset-left
  "[@media(max-width:350px)]:[&_.pu-reset-left]:[font-size:9px]",
  // .quota-bar
  "[&_.quota-bar]:[height:6px]", "[&_.quota-bar]:[border-radius:4px]", "[&_.quota-bar]:[background-image:none]", "[&_.quota-bar]:[background-position:0%_0%]", "[&_.quota-bar]:[background-size:auto]", "[&_.quota-bar]:[background-repeat:repeat]", "[&_.quota-bar]:[background-origin:padding-box]", "[&_.quota-bar]:[background-clip:border-box]", "[&_.quota-bar]:[background-attachment:scroll]", "[&_.quota-bar]:[background-color:rgb(229,_227,_223)]", "[&_.quota-bar]:[background:rgb(229,_227,_223)]", "[&_.quota-bar]:[position:relative]", "[&_.quota-bar]:[margin-top:4px]",
  // .quota-bar .fill
  "[&_.quota-bar_.fill]:[position:absolute]", "[&_.quota-bar_.fill]:[left:0px]", "[&_.quota-bar_.fill]:[top:0px]", "[&_.quota-bar_.fill]:[bottom:0px]", "[&_.quota-bar_.fill]:[min-width:0px]", "[&_.quota-bar_.fill]:[border-radius:4px]", "[&_.quota-bar_.fill]:[background:var(--color)]",
  // .quota-bar .elapsed
  "[&_.quota-bar_.elapsed]:[position:absolute]", "[&_.quota-bar_.elapsed]:[top:-2px]", "[&_.quota-bar_.elapsed]:[width:1px]", "[&_.quota-bar_.elapsed]:[height:10px]", "[&_.quota-bar_.elapsed]:[background-image:none]", "[&_.quota-bar_.elapsed]:[background-position:0%_0%]", "[&_.quota-bar_.elapsed]:[background-size:auto]", "[&_.quota-bar_.elapsed]:[background-repeat:repeat]", "[&_.quota-bar_.elapsed]:[background-origin:padding-box]", "[&_.quota-bar_.elapsed]:[background-clip:border-box]", "[&_.quota-bar_.elapsed]:[background-attachment:scroll]", "[&_.quota-bar_.elapsed]:[background-color:rgb(53,_53,_48)]", "[&_.quota-bar_.elapsed]:[background:rgb(53,_53,_48)]",
  // .calendar
  "[&_.calendar]:[margin-top:2px]", "[&_.calendar]:[margin-right:12px]", "[&_.calendar]:[margin-bottom:0px]", "[&_.calendar]:[margin-left:12px]", "[&_.calendar]:[margin:2px_12px_0px]", "[&_.calendar]:[padding-top:6px]", "[&_.calendar]:[border-top:1px_solid_rgb(227,_224,_219)]", "[&_.calendar]:[border-top-width:1px]", "[&_.calendar]:[border-top-style:solid]", "[&_.calendar]:[border-top-color:rgb(227,_224,_219)]", "[&_.calendar]:[padding-bottom:9px]",
  // .row-chart
  "[&_.row-chart]:[padding-top:8px]", "[&_.row-chart]:[padding-right:12px]", "[&_.row-chart]:[padding-bottom:0px]", "[&_.row-chart]:[padding-left:12px]", "[&_.row-chart]:[padding:10px_12px_0px]", "[&_.row-chart]:[--identity-width:clamp(190px,56.4vw,260px)]",
  // (min-width:600px) .calendar
  "[@media(min-width:600px)]:[&_.calendar]:[margin-inline:20px]",
  // (min-width:600px) .row-chart
  "[@media(min-width:600px)]:[&_.row-chart]:[padding-inline:20px]",
  // (max-width:350px) .row-chart
  "[@media(max-width:350px)]:[&_.row-chart]:[padding-inline:10px]",
  // (max-width:350px) .calendar
  "[@media(max-width:350px)]:[&_.calendar]:[margin-inline:10px]",
  // .quota-bar.last-reading .fill
  "[&_.quota-bar.last-reading_.fill]:[background-image:none]", "[&_.quota-bar.last-reading_.fill]:[background-position:0%_0%]", "[&_.quota-bar.last-reading_.fill]:[background-size:auto]", "[&_.quota-bar.last-reading_.fill]:[background-repeat:repeat]", "[&_.quota-bar.last-reading_.fill]:[background-origin:padding-box]", "[&_.quota-bar.last-reading_.fill]:[background-clip:border-box]", "[&_.quota-bar.last-reading_.fill]:[background-attachment:scroll]", "[&_.quota-bar.last-reading_.fill]:[background-color:rgb(168,_164,_155)]", "[&_.quota-bar.last-reading_.fill]:[background:rgb(168,_164,_155)]",
  // .quota-bar.unavailable
  "[&_.quota-bar.unavailable]:[background-image:none]", "[&_.quota-bar.unavailable]:[background-position:0%_0%]", "[&_.quota-bar.unavailable]:[background-size:auto]", "[&_.quota-bar.unavailable]:[background-repeat:repeat]", "[&_.quota-bar.unavailable]:[background-origin:padding-box]", "[&_.quota-bar.unavailable]:[background-clip:border-box]", "[&_.quota-bar.unavailable]:[background-attachment:scroll]", "[&_.quota-bar.unavailable]:[background-color:transparent]", "[&_.quota-bar.unavailable]:[background:transparent]", "[&_.quota-bar.unavailable]:[border:1px_solid_rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-width:1px]", "[&_.quota-bar.unavailable]:[border-style:solid]", "[&_.quota-bar.unavailable]:[border-color:rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-top:1px_solid_rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-top-width:1px]", "[&_.quota-bar.unavailable]:[border-top-style:solid]", "[&_.quota-bar.unavailable]:[border-top-color:rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-right:1px_solid_rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-right-width:1px]", "[&_.quota-bar.unavailable]:[border-right-style:solid]", "[&_.quota-bar.unavailable]:[border-right-color:rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-bottom:1px_solid_rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-bottom-width:1px]", "[&_.quota-bar.unavailable]:[border-bottom-style:solid]", "[&_.quota-bar.unavailable]:[border-bottom-color:rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-left:1px_solid_rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-left-width:1px]", "[&_.quota-bar.unavailable]:[border-left-style:solid]", "[&_.quota-bar.unavailable]:[border-left-color:rgb(217,_214,_207)]", "[&_.quota-bar.unavailable]:[border-image:none]",
  // .history-grid
  "[&_.history-grid]:[--identity-width:clamp(190px,50vw,212px)]", "[&_.history-grid]:[display:grid]", "[&_.history-grid]:[grid-template-columns:var(--identity-width)_minmax(0,1fr)]", "[&_.history-grid]:[align-items:start]",
  // .history-fixed
  "[&_.history-fixed]:[min-width:0px]",
  // .history-fixed-row
  "[&_.history-fixed-row]:[min-height:45px]", "[&_.history-fixed-row]:[border-top:1px_solid_rgb(231,_227,_220)]", "[&_.history-fixed-row]:[border-top-width:1px]", "[&_.history-fixed-row]:[border-top-style:solid]", "[&_.history-fixed-row]:[border-top-color:rgb(231,_227,_220)]",
  // .history-rail-tools
  "[&_.history-rail-tools]:[height:28px]", "[&_.history-rail-tools]:[display:flex]", "[&_.history-rail-tools]:[align-items:center]", "[&_.history-rail-tools]:[gap:6px]", "[&_.history-rail-tools]:[padding-right:7px]", "[&_.history-rail-tools]:[color:rgb(130,_123,_114)]", "[&_.history-rail-tools]:[font-size:10px]",
  // .history-rail-legend
  "[&_.history-rail-legend]:[display:flex]", "[&_.history-rail-legend]:[align-items:center]", "[&_.history-rail-legend]:[gap:4px]", "[&_.history-rail-legend]:[padding-top:0px]", "[&_.history-rail-legend]:[padding-right:0px]", "[&_.history-rail-legend]:[padding-bottom:0px]", "[&_.history-rail-legend]:[padding-left:0px]", "[&_.history-rail-legend]:[padding:0px]", "[&_.history-rail-legend]:[font-size:10px]", "[&_.history-rail-legend]:[white-space:nowrap]", "[&_.history-rail-legend]:[min-height:26px]",
  // .history-rail-legend svg
  "[&_.history-rail-legend_svg]:[width:12px]", "[&_.history-rail-legend_svg]:[height:12px]", "[&_.history-rail-legend_svg]:[margin-left:1px]",
  // .legend-recorded
  "[&_.legend-recorded]:[width:5px]", "[&_.legend-recorded]:[height:5px]", "[&_.legend-recorded]:[border-radius:50%]", "[&_.legend-recorded]:[background-image:none]", "[&_.legend-recorded]:[background-position:0%_0%]", "[&_.legend-recorded]:[background-size:auto]", "[&_.legend-recorded]:[background-repeat:repeat]", "[&_.legend-recorded]:[background-origin:padding-box]", "[&_.legend-recorded]:[background-clip:border-box]", "[&_.legend-recorded]:[background-attachment:scroll]", "[&_.legend-recorded]:[background-color:rgb(140,_133,_124)]", "[&_.legend-recorded]:[background:rgb(140,_133,_124)]",
  // .history-rail-month
  "[&_.history-rail-month]:[margin-left:auto]", "[&_.history-rail-month]:[white-space:nowrap]",
  // .history-today
  "[&_.history-today]:[padding-top:0px]", "[&_.history-today]:[padding-right:0px]", "[&_.history-today]:[padding-bottom:0px]", "[&_.history-today]:[padding-left:0px]", "[&_.history-today]:[padding:0px]", "[&_.history-today]:[color:rgb(62,_119,_98)]", "[&_.history-today]:[font-size:10px]", "[&_.history-today]:[min-height:26px]", "[&_.history-today]:[visibility:hidden]",
  // .history-rail-scroll
  "[&_.history-rail-scroll]:[min-width:0px]", "[&_.history-rail-scroll]:[overflow-x:auto]", "[&_.history-rail-scroll]:[overflow-y:hidden]", "[&_.history-rail-scroll]:[overscroll-behavior-x:contain]", "[&_.history-rail-scroll]:[touch-action:pan-x_pan-y_pinch-zoom]", "[&_.history-rail-scroll]:[scrollbar-width:none]", "[&_.history-rail-scroll]:[border-left:1px_solid_rgb(231,_227,_220)]", "[&_.history-rail-scroll]:[border-left-width:1px]", "[&_.history-rail-scroll]:[border-left-style:solid]", "[&_.history-rail-scroll]:[border-left-color:rgb(231,_227,_220)]",
  // .history-rail-scroll::-webkit-scrollbar
  "[&_.history-rail-scroll::-webkit-scrollbar]:[display:none]",
  // .history-rail-scroll:focus-visible
  "[&_.history-rail-scroll:focus-visible]:[outline:2px_solid_#6c8f7d]", "[&_.history-rail-scroll:focus-visible]:[outline-offset:-2px]",
  // .history-rail-canvas
  "[&_.history-rail-canvas]:[position:relative]", "[&_.history-rail-canvas]:[min-width:100%]",
  // .history-rail-dates
  "[&_.history-rail-dates]:[height:28px]", "[&_.history-rail-dates]:[display:grid]", "[&_.history-rail-dates]:[grid-auto-flow:column]", "[&_.history-rail-dates]:[grid-auto-columns:var(--rail-cell)]", "[&_.history-rail-dates]:[font-size:11px]", "[&_.history-rail-dates]:[line-height:13px]", "[&_.history-rail-dates]:[color:rgb(142,_135,_125)]", "[&_.history-rail-dates]:[text-align:center]",
  // .history-rail-dates>span
  "[&_.history-rail-dates>span]:[display:flex]", "[&_.history-rail-dates>span]:[flex-direction:column]", "[&_.history-rail-dates>span]:[align-items:center]", "[&_.history-rail-dates>span]:[padding-top:1px]", "[&_.history-rail-dates>span]:[font-variant-numeric:tabular-nums]",
  // .history-rail-dates b
  "[&_.history-rail-dates_b]:[font-weight:400]", "[&_.history-rail-dates_b]:[color:rgb(117,_109,_99)]",
  // .history-rail-dates .is-today
  "[&_.history-rail-dates_.is-today]:[font-weight:600]", "[&_.history-rail-dates_.is-today]:[color:rgb(78,_73,_65)]",
  // .history-rail-dates .is-today b
  "[&_.history-rail-dates_.is-today_b]:[font-weight:600]", "[&_.history-rail-dates_.is-today_b]:[color:rgb(78,_73,_65)]",
  // .history-rail-lane
  "[&_.history-rail-lane]:[position:relative]", "[&_.history-rail-lane]:[border-top:1px_solid_rgb(231,_227,_220)]", "[&_.history-rail-lane]:[border-top-width:1px]", "[&_.history-rail-lane]:[border-top-style:solid]", "[&_.history-rail-lane]:[border-top-color:rgb(231,_227,_220)]",
  // .history-day-shade
  "[&_.history-day-shade]:[position:absolute]", "[&_.history-day-shade]:[top:0px]", "[&_.history-day-shade]:[bottom:0px]", "[&_.history-day-shade]:[background-image:none]", "[&_.history-day-shade]:[background-position:0%_0%]", "[&_.history-day-shade]:[background-size:auto]", "[&_.history-day-shade]:[background-repeat:repeat]", "[&_.history-day-shade]:[background-origin:padding-box]", "[&_.history-day-shade]:[background-clip:border-box]", "[&_.history-day-shade]:[background-attachment:scroll]", "[&_.history-day-shade]:[background-color:rgb(239,_237,_232)]", "[&_.history-day-shade]:[background:rgb(239,_237,_232)]", "[&_.history-day-shade]:[pointer-events:none]",
  // .history-now
  "[&_.history-now]:[position:absolute]", "[&_.history-now]:[top:0px]", "[&_.history-now]:[bottom:0px]", "[&_.history-now]:[border-left:1px_solid_rgb(153,_149,_140)]", "[&_.history-now]:[border-left-width:1px]", "[&_.history-now]:[border-left-style:solid]", "[&_.history-now]:[border-left-color:rgb(153,_149,_140)]", "[&_.history-now]:[pointer-events:none]",
  // .history-baseline
  "[&_.history-baseline]:[position:absolute]", "[&_.history-baseline]:[left:0px]", "[&_.history-baseline]:[right:0px]", "[&_.history-baseline]:[top:21px]", "[&_.history-baseline]:[border-top:1px_solid_rgb(222,_218,_211)]", "[&_.history-baseline]:[border-top-width:1px]", "[&_.history-baseline]:[border-top-style:solid]", "[&_.history-baseline]:[border-top-color:rgb(222,_218,_211)]", "[&_.history-baseline]:[pointer-events:none]",
  // .history-usage-marker
  "[&_.history-usage-marker]:[position:absolute]", "[&_.history-usage-marker]:[top:0px]", "[&_.history-usage-marker]:[width:40px]", "[&_.history-usage-marker]:[height:44px]", "[&_.history-usage-marker]:[padding-top:0px]", "[&_.history-usage-marker]:[padding-right:0px]", "[&_.history-usage-marker]:[padding-bottom:0px]", "[&_.history-usage-marker]:[padding-left:0px]", "[&_.history-usage-marker]:[padding:0px]", "[&_.history-usage-marker]:[transform:translateX(-50%)]", "[&_.history-usage-marker]:[color:var(--color)]", "[&_.history-usage-marker]:[z-index:2]", "[&_.history-usage-marker]:[font-size:11px]", "[&_.history-usage-marker]:[font-variant-numeric:tabular-nums]",
  // .history-usage-point
  "[&_.history-usage-point]:[position:absolute]", "[&_.history-usage-point]:[left:50%]", "[&_.history-usage-point]:[top:17px]", "[&_.history-usage-point]:[width:7px]", "[&_.history-usage-point]:[height:7px]", "[&_.history-usage-point]:[transform:translateX(-50%)]", "[&_.history-usage-point]:[border-radius:50%]", "[&_.history-usage-point]:[background:var(--color)]", "[&_.history-usage-point]:[border:1px_solid_rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-width:1px]", "[&_.history-usage-point]:[border-style:solid]", "[&_.history-usage-point]:[border-color:rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-top:1px_solid_rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-top-width:1px]", "[&_.history-usage-point]:[border-top-style:solid]", "[&_.history-usage-point]:[border-top-color:rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-right:1px_solid_rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-right-width:1px]", "[&_.history-usage-point]:[border-right-style:solid]", "[&_.history-usage-point]:[border-right-color:rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-bottom:1px_solid_rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-bottom-width:1px]", "[&_.history-usage-point]:[border-bottom-style:solid]", "[&_.history-usage-point]:[border-bottom-color:rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-left:1px_solid_rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-left-width:1px]", "[&_.history-usage-point]:[border-left-style:solid]", "[&_.history-usage-point]:[border-left-color:rgb(245,_245,_244)]", "[&_.history-usage-point]:[border-image:none]",
  // .projected .history-usage-point
  "[&_.projected_.history-usage-point]:[background-image:none]", "[&_.projected_.history-usage-point]:[background-position:0%_0%]", "[&_.projected_.history-usage-point]:[background-size:auto]", "[&_.projected_.history-usage-point]:[background-repeat:repeat]", "[&_.projected_.history-usage-point]:[background-origin:padding-box]", "[&_.projected_.history-usage-point]:[background-clip:border-box]", "[&_.projected_.history-usage-point]:[background-attachment:scroll]", "[&_.projected_.history-usage-point]:[background-color:rgb(245,_245,_244)]", "[&_.projected_.history-usage-point]:[background:rgb(245,_245,_244)]", "[&_.projected_.history-usage-point]:[border:1.5px_dashed_var(--color)]",
  // .history-usage-value
  "[&_.history-usage-value]:[position:absolute]", "[&_.history-usage-value]:[left:50%]", "[&_.history-usage-value]:[top:27px]", "[&_.history-usage-value]:[line-height:14px]", "[&_.history-usage-value]:[white-space:nowrap]", "[&_.history-usage-value]:[transform:translateX(-50%)]", "[&_.history-usage-value]:[color:rgb(112,_105,_95)]", "[&_.history-usage-value]:[background-image:none]", "[&_.history-usage-value]:[background-position:0%_0%]", "[&_.history-usage-value]:[background-size:auto]", "[&_.history-usage-value]:[background-repeat:repeat]", "[&_.history-usage-value]:[background-origin:padding-box]", "[&_.history-usage-value]:[background-clip:border-box]", "[&_.history-usage-value]:[background-attachment:scroll]", "[&_.history-usage-value]:[background-color:rgb(245,_245,_244)]", "[&_.history-usage-value]:[background:rgb(245,_245,_244)]", "[&_.history-usage-value]:[padding-top:0px]", "[&_.history-usage-value]:[padding-right:1px]", "[&_.history-usage-value]:[padding-bottom:0px]", "[&_.history-usage-value]:[padding-left:1px]", "[&_.history-usage-value]:[padding:0px_1px]",
  // .recorded .history-usage-value
  "[&_.recorded_.history-usage-value]:[top:1px]",
  // .daily-bars
  "[&_.daily-bars]:[display:grid]", "[&_.daily-bars]:[grid-template-columns:repeat(7,minmax(0,1fr))]", "[&_.daily-bars]:[height:71px]", "[&_.daily-bars]:[gap:3px]", "[&_.daily-bars]:[position:relative]", "[&_.daily-bars]:[touch-action:pan-y]",
  // .daily-bar
  "[&_.daily-bar]:[display:flex]", "[&_.daily-bar]:[flex-direction:column]", "[&_.daily-bar]:[min-width:0px]", "[&_.daily-bar]:[padding-top:0px]", "[&_.daily-bar]:[padding-right:0px]", "[&_.daily-bar]:[padding-bottom:0px]", "[&_.daily-bar]:[padding-left:0px]", "[&_.daily-bar]:[padding:0px]", "[&_.daily-bar]:[height:71px]", "[&_.daily-bar]:[gap:3px]",
  // .daily-bar-track
  "[&_.daily-bar-track]:[display:block]", "[&_.daily-bar-track]:[position:relative]", "[&_.daily-bar-track]:[height:52px]", "[&_.daily-bar-track]:[width:100%]", "[&_.daily-bar-track]:[border-bottom:1px_solid_rgb(216,_212,_204)]", "[&_.daily-bar-track]:[border-bottom-width:1px]", "[&_.daily-bar-track]:[border-bottom-style:solid]", "[&_.daily-bar-track]:[border-bottom-color:rgb(216,_212,_204)]", "[&_.daily-bar-track]:[background-image:none]", "[&_.daily-bar-track]:[background-position:0%_0%]", "[&_.daily-bar-track]:[background-size:auto]", "[&_.daily-bar-track]:[background-repeat:repeat]", "[&_.daily-bar-track]:[background-origin:padding-box]", "[&_.daily-bar-track]:[background-clip:border-box]", "[&_.daily-bar-track]:[background-attachment:scroll]", "[&_.daily-bar-track]:[background-color:transparent]",
  // .daily-fill
  "[&_.daily-fill]:[display:block]", "[&_.daily-fill]:[position:absolute]", "[&_.daily-fill]:[bottom:0px]", "[&_.daily-fill]:[left:0px]", "[&_.daily-fill]:[width:100%]", "[&_.daily-fill]:[border-radius:2px_2px_0_0]", "[&_.daily-fill]:[background:var(--daily-color)]", "[&_.daily-fill]:[opacity:0.82]",
  // .daily-bar.partial .daily-fill
  "[&_.daily-bar.partial_.daily-fill]:[opacity:0.75]",
  // .daily-bar.missing .daily-bar-track
  "[&_.daily-bar.missing_.daily-bar-track]:[background-image:repeating-linear-gradient(135deg,_transparent,_transparent_3px,_rgba(220,_215,_205,_0.533)_3px,_rgba(220,_215,_205,_0.533)_4px)]", "[&_.daily-bar.missing_.daily-bar-track]:[background-position:0%_0%]", "[&_.daily-bar.missing_.daily-bar-track]:[background-size:auto]", "[&_.daily-bar.missing_.daily-bar-track]:[background-repeat:repeat]", "[&_.daily-bar.missing_.daily-bar-track]:[background-origin:padding-box]", "[&_.daily-bar.missing_.daily-bar-track]:[background-clip:border-box]", "[&_.daily-bar.missing_.daily-bar-track]:[background-attachment:scroll]", "[&_.daily-bar.missing_.daily-bar-track]:[background-color:transparent]", "[&_.daily-bar.missing_.daily-bar-track]:[background:repeating-linear-gradient(135deg,_transparent,_transparent_3px,_rgba(220,_215,_205,_0.533)_3px,_rgba(220,_215,_205,_0.533)_4px)]",
  // .daily-zero
  "[&_.daily-zero]:[position:absolute]", "[&_.daily-zero]:[bottom:0px]", "[&_.daily-zero]:[left:50%]", "[&_.daily-zero]:[transform:translateX(-50%)]", "[&_.daily-zero]:[width:3px]", "[&_.daily-zero]:[height:3px]", "[&_.daily-zero]:[background:var(--daily-color)]", "[&_.daily-zero]:[border-radius:50%]",
  // .daily-bar.partial .daily-zero
  "[&_.daily-bar.partial_.daily-zero]:[background-image:none]", "[&_.daily-bar.partial_.daily-zero]:[background-position:0%_0%]", "[&_.daily-bar.partial_.daily-zero]:[background-size:auto]", "[&_.daily-bar.partial_.daily-zero]:[background-repeat:repeat]", "[&_.daily-bar.partial_.daily-zero]:[background-origin:padding-box]", "[&_.daily-bar.partial_.daily-zero]:[background-clip:border-box]", "[&_.daily-bar.partial_.daily-zero]:[background-attachment:scroll]", "[&_.daily-bar.partial_.daily-zero]:[background-color:transparent]", "[&_.daily-bar.partial_.daily-zero]:[background:transparent]", "[&_.daily-bar.partial_.daily-zero]:[border:1px_solid_var(--daily-color)]",
  // .daily-bar.is-today .daily-fill
  "[&_.daily-bar.is-today_.daily-fill]:[border-top:1px_dashed_rgb(245,_245,_244)]", "[&_.daily-bar.is-today_.daily-fill]:[border-top-width:1px]", "[&_.daily-bar.is-today_.daily-fill]:[border-top-style:dashed]", "[&_.daily-bar.is-today_.daily-fill]:[border-top-color:rgb(245,_245,_244)]",
  // .daily-bar small
  "[&_.daily-bar_small]:[display:block]", "[&_.daily-bar_small]:[height:13px]", "[&_.daily-bar_small]:[line-height:13px]", "[&_.daily-bar_small]:[font-size:10px]", "[&_.daily-bar_small]:[color:rgb(138,_129,_117)]", "[&_.daily-bar_small]:[font-variant-numeric:tabular-nums]",
  // .daily-bar:focus-visible
  "[&_.daily-bar:focus-visible]:[outline-offset:1px]", "[&_.daily-bar:focus-visible]:[z-index:1]",
  // .daily-selected .daily-bar-track
  "[&_.daily-selected_.daily-bar-track]:[outline:1px_solid_var(--daily-color)]", "[&_.daily-selected_.daily-bar-track]:[outline-offset:1px]", "[&_.daily-selected_.daily-bar-track]:[border-radius:2px]",
  // (max-width:350px) .daily-bars
  "[@media(max-width:350px)]:[&_.daily-bars]:[gap:2px]",
  // .daily-loading
  "[&_.daily-loading]:[padding-top:20px]", "[&_.daily-loading]:[padding-right:12px]", "[&_.daily-loading]:[padding-bottom:20px]", "[&_.daily-loading]:[padding-left:12px]", "[&_.daily-loading]:[padding:20px_12px]", "[&_.daily-loading]:[color:rgb(120,_113,_108)]", "[&_.daily-loading]:[font-size:13px]",
 ];
 const $=id=>document.getElementById(id);
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const P={codex:{name:'Codex',color:'#169b7e'},gemini:{name:'Gemini',color:'#2a71ce'},claude:{name:'Claude',color:'#c77d55'}};
 const mark=key=>window.assistantMark?.svg(key,{cls:'brand'})||'';
 const DATA={providers:[]};
 const emptyHistory=()=>({schemaVersion:1,periods:[],tokenDays:[],adjustments:[],dailyAllowance:{days:[],providers:[]}});
 let HISTORY=emptyHistory(),snapshot=null,now=Date.now(),host=null;
 let archiveLoaded=false,archiveBusy=false,archiveAttempted=false,archiveSaved=false;
 let timelineFollowToday=true,timelineAnchor=null,timelinePlan=null,timelineRestoring=false,timelinePointer=false,timelineLastScroll=0,timelineDeferred,timelineKeyboardDetail=false;
 let selectedDailyDay=null,detailAnchor=null,rendering=false;
 const HISTORY_KEY='web-tools-phone-usage-history-v1',MAX_HISTORY=8*1024*1024;
 function currentRows(key){
  return rows(key).filter(row=>row.durationMinutes===10080).sort((a,b)=>{
   const account=row=>!row.label||row.label==='All models'||row.label.toLowerCase()===key;
   return Number(account(b))-Number(account(a))||(b.usedPercent??-1)-(a.usedPercent??-1);
  });
 }
const paths={activity:'M2 12h4l3-8 6 16 3-8h4',hand:'M18 11V7a2 2 0 0 0-4 0v4M14 10V5a2 2 0 0 0-4 0v6M10 10.5V7a2 2 0 0 0-4 0v9M18 8a2 2 0 1 1 4 0v8a6 6 0 0 1-6 6h-2c-2.1 0-3.4-.6-4.5-1.7l-5.4-5.4a2 2 0 0 1 2.8-2.8L6 13',hourglass:'M6 3h12M6 21h12M7 3v4l10 10v4M17 3v4L7 17v4',clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',check:'m5 12 4 4L19 6',pause:'M9 5v14M15 5v14',circle:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0',alert:'M12 8v5m0 3v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',reply:'M9 5 3 11l6 6M3 11h12a6 6 0 0 1 6 6',more:'M12 5h.01M12 12h.01M12 19h.01',detail:'M8 3h9l4 4v14H5V3Zm9 0v5h4M9 12h8M9 16h6',copy:'M9 5H5v16h12v-4M9 3h12v14H9Z',open:'M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',windows:'M8 21h8m-4-5v5m-5-11h10m-3-3 3 3-3 3',cloud:'M6.5 19a4.5 4.5 0 0 1-.8-8.93A6.5 6.5 0 0 1 18.5 9a5 5 0 0 1-.5 10Z',laptop:'M4 16 2 20h20l-2-4M9 20h6',reset:'M20 7v5h-5M4 17v-5h5M5.5 7a7.5 7.5 0 0 1 12.8-1L20 9M4 15l1.7 3a7.5 7.5 0 0 0 12.8-1',folder:'M3 7V5h6l2 2h10v13H3Z',repo:'M5 3h14v18H5Zm4 0v18M5 17h14',speaker:'M3 9v6h4l5 4V5L7 9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name==='windows'?'<rect x="3" y="4" width="18" height="12" rx="2"/>':name==='laptop'?'<rect x="4" y="3" width="16" height="13" rx="1.5"/>':''}<path d="${paths[name]||name}"/></svg>`;
const numeric=value=>!['number','string'].includes(typeof value)||String(value).trim()===''?null:Number.isFinite(Number(value))?Number(value):null;
const providerData=key=>DATA.providers.find(p=>p.provider===key)||{};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
function periodName(minutes,label='Limit'){
 if(minutes===10080)return 'Week';
 if(minutes===1440)return 'Day';
 if(minutes>0)return minutes%1440===0?minutes/1440+'d':minutes%60===0?minutes/60+'h':minutes+'m';
 return label;
}
function rows(key){
 const provider=providerData(key),raw=provider.windows;
 const windows=Array.isArray(raw)?raw:raw&&typeof raw==='object'?[raw]:[];
 const seen=new Map();
 return windows.filter(w=>w&&typeof w==='object').map((w,index)=>{
  const duration=numeric(w.durationMinutes),minutes=duration>0?duration:null,used=numeric(w.usedPercent);
  const sourceLabel=typeof w.label==='string'?w.label.trim():'';
  const generic=!sourceLabel||sourceLabel.toLowerCase()===key||sourceLabel.toLowerCase()===P[key].name.toLowerCase()||sourceLabel==='All models';
  const period=periodName(minutes,generic?'Limit':sourceLabel);
  const scope=minutes&&!generic?sourceLabel:'';
  const base=(minutes||'unknown')+'|'+(scope||(!minutes?period:''));
  const duplicate=seen.get(base)||0;seen.set(base,duplicate+1);
  return {...w,id:w.id||key+'-window-'+index,durationMinutes:minutes,usedPercent:used!==null&&used>=0?used:null,resetsAt:validDate(w.resetsAt)?w.resetsAt:null,period,labelText:scope?period+' · '+scope:period,slot:base+(duplicate?'|'+duplicate:'')};
 }).sort((a,b)=>(a.durationMinutes===10080?-1:a.durationMinutes||Infinity)-(b.durationMinutes===10080?-1:b.durationMinutes||Infinity)||a.labelText.localeCompare(b.labelText));
}
const pc=w=>w.usedPercent===null?'Unavailable':w.usedPercent>0&&w.usedPercent<1?'&lt;1':String(Math.round(w.usedPercent));
const expired=w=>w.resetsAt&&Date.parse(w.resetsAt)<=now;
function stale(key){const p=providerData(key),at=Date.parse(p.observedAt);return p.status!=='available'||!Number.isFinite(at)||now-at>600000||at-now>60000;}
function elapsed(w,key){
 if(!w.durationMinutes||!w.resetsAt||expired(w)||stale(key)||w.usedPercent===null)return null;
 const startAt=Date.parse(w.resetsAt)-w.durationMinutes*60000;
 if(now<startAt)return null;
 return Math.max(0,Math.min(100,(now-startAt)/(w.durationMinutes*60000)*100));
}
function meter(key,w){
 const unavailable=w.usedPercent===null||expired(w),pace=elapsed(w,key);
 return `<span class="quota-bar ${stale(key)||expired(w)?'last-reading':''} ${unavailable?'unavailable':''}" ${unavailable?'aria-hidden="true"':`role="progressbar" aria-label="${P[key].name} ${esc(w.labelText)} allowance used" aria-valuenow="${w.usedPercent}" aria-valuemin="0" aria-valuemax="${Math.max(100,w.usedPercent)}"`} style="--color:${P[key].color}">${!unavailable?`<span class="fill" style="width:${Math.min(100,w.usedPercent)}%"></span>`:''}${pace!==null?`<span class="elapsed" style="left:${pace}%"></span>`:''}</span>`;
}
function archiveGroups(key){
 const minutes=10080,current=currentRows(key)[0];
 const groups=new Map();
 for(const record of HISTORY.periods||[]){
  if(record.provider!==key||record.minutes!==minutes||(current&&record.bucket!==current.id))continue;
  const reset=Date.parse(record.reset),at=Date.parse(record.last_at),value=numeric(record.last_used);
  if(!Number.isFinite(reset)||!Number.isFinite(at)||reset>=now||at>reset||value===null||value<0)continue;
  const date=NowUsage.calendarDay(record.reset,calendarZone()),group=groups.get(date)||{key,id:key+'|saved|'+minutes+'|'+date,date,reset:record.reset,last:record.last_at,value,peak:numeric(record.peak),samples:0,revisions:0,kind:'recorded'};
  group.samples+=record.samples||0;group.revisions++;
  if(at>=Date.parse(group.last)){group.last=record.last_at;group.reset=record.reset;group.value=value;}
  group.peak=Math.max(group.peak??value,numeric(record.peak)??value);
  groups.set(date,group);
 }
 return [...groups.values()].sort((a,b)=>Date.parse(a.reset)-Date.parse(b.reset));
}
function usageForecast(key,window=currentRows(key)[0]){
 if(!window||!window.durationMinutes||!window.resetsAt||window.usedPercent===null||expired(window)||stale(key))return null;
 const observed=Date.parse(providerData(key).observedAt),reset=Date.parse(window.resetsAt),duration=window.durationMinutes*60000,elapsed=observed-(reset-duration);
 if(!Number.isFinite(observed)||elapsed<Math.max(600000,duration*.01)||elapsed>duration)return null;
 const restore=allowanceDrops(key,window).filter(event=>event.confirmed_restore&&Math.abs(Date.parse(event.reset)-reset)<=120000&&Date.parse(event.at)<=observed).at(-1);
 if(restore){
  const since=observed-Date.parse(restore.at),increase=window.usedPercent-restore.after;
  if(since<600000||increase<0)return null;
  const value=window.usedPercent+increase/since*(reset-observed);
  return Number.isFinite(value)?{value,used:window.usedPercent,elapsed:elapsed/duration*100,at:observed,restored:true,baseline:restore.after,since:restore.at}:null;
 }
 const estimate=window.usedPercent*duration/elapsed;
 return Number.isFinite(estimate)?{value:estimate,used:window.usedPercent,elapsed:elapsed/duration*100,at:observed}:null;
}
function allowanceDrops(key,window=currentRows(key)[0]){
 const bucket=window?.id||({claude:'seven_day',gemini:'gemini-weekly',codex:'codex:primary'})[key];
 return (HISTORY.adjustments||[]).filter(row=>row.provider===key&&row.bucket===bucket&&row.minutes===(window?.durationMinutes||10080)&&Date.parse(row.at)<=now&&Number.isFinite(row.drop)&&row.drop>0);
}
function allowanceDropMarkers(key){
 const groups=new Map();
 for(const event of allowanceDrops(key).filter(event=>event.drop>=1)){
  const date=NowUsage.calendarDay(event.at,calendarZone());if(!date)continue;
  let group=groups.get(date);if(!group){group={key,id:key+'|decrease|'+date,kind:'decrease',events:[],value:event.drop,reset:event.at};groups.set(date,group);}
  group.events.push(event);if(event.drop>group.value){group.value=event.drop;group.reset=event.at;}
 }
 return [...groups.values()];
}
function availablePace(key,window=currentRows(key)[0]){
 const provider=providerData(key);
 return NowUsage.remainingPace(window,{now,observedAt:provider.observedAt,status:provider.status});
}
function paceLabel(value){
 if(value===null)return '—';
 if(value>0&&value<.01)return '<0.01×';
 return (value>=1000?shortNumber(value):new Intl.NumberFormat('en-US',{maximumFractionDigits:value>=10?1:2}).format(value))+'×';
}
function timelineMarkers(key){
 const markers=[...archiveGroups(key),...allowanceDropMarkers(key)],window=currentRows(key)[0];
 if(window?.resetsAt&&Date.parse(window.resetsAt)>now){
  markers.push({key,id:key+'|upcoming|'+window.id+'|'+window.resetsAt,kind:'upcoming',reset:window.resetsAt,value:window.usedPercent,window,unavailable:window.usedPercent===null||stale(key)});
 }
 return markers;
}
function calendarZone(){
 const candidate=HISTORY.dailyAllowance?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 try{return new Intl.DateTimeFormat('en-US',{timeZone:candidate==='Pacific time'?'America/Los_Angeles':candidate}).resolvedOptions().timeZone;}
 catch{return null;}
}
function createTimelinePlan(width){
 return NowUsage.calendarAxis({width,now,timezone:calendarZone(),dates:dailyModel().dates,markers:Object.keys(P).flatMap(timelineMarkers)});
}
function railX(value,plan=timelinePlan){return plan?.x(value)??0;}
function railTime(x,plan=timelinePlan){return plan?.time(x)??now;}
function timelineValue(marker){
 if(marker.kind==='upcoming')return marker.value===null?'—':(marker.value>0&&marker.value<1?'<1':Math.round(marker.value))+'%'+(marker.unavailable?'*':'');
 if(marker.kind==='decrease')return '−'+(marker.value<1?'<1':Math.round(marker.value))+'pp';
 if(marker.value===null)return '?';
 const value=marker.value>0&&marker.value<1?'<1':marker.value>=1000?shortNumber(marker.value):Math.round(marker.value);
 return (marker.kind==='projected'?'~':'')+value+'%';
}
function calendarFooter(){
 const model=dailyModel();
 if(!model.dates.length)return `<div class="daily-loading" role="status">${archiveAttempted?'Daily readings unavailable':'Loading saved readings…'}</div>`;
 return `<div class="calendar-footer"><button data-daily-info aria-label="About daily allowance history">Bars · 0–${model.ceiling}% of week ${icon('M12 8v.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0')}</button><div class="daily-patterns">${model.series.some(series=>series.days.some(day=>day.state==='partial'))?'<span><i class="daily-partial-key"></i>Partial</span>':''}${model.series.some(series=>series.days.some(day=>day.state==='missing'))?'<span><i class="daily-missing-key"></i>No reading</span>':''}</div></div><div class="calendar-coverage"><button data-pace-guide-info class="calendar-rate-key" aria-label="About even pace and catch-up daily rate lines"><i aria-hidden="true"></i>Even <i class="catch-up" aria-hidden="true"></i>Catch up</button><span>${esc(model.timezone)}</span></div>`;
}
function rowChart(){
 return `<div class="row-chart usage-calendar"><div class="history-rail-tools"><button class="history-rail-legend" data-timeline-info aria-label="About current use and available pace"><span class="legend-current" aria-hidden="true"></span>Now <span class="legend-recorded" aria-hidden="true">${NowUsage.resetMarker()}</span>Reset <span class="legend-drop" aria-hidden="true"></span>Drop ${icon('M12 8v.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0')}</button><span class="history-rail-month"></span><button class="history-today" data-timeline-today>Today</button></div><div class="history-grid"><div class="history-fixed"><div class="history-date-spacer" aria-hidden="true"></div><div id="history-identities">${timelineIdentityHTML()}</div></div><div id="reset-history-scroll" class="history-rail-scroll" data-no-swipe role="region" tabindex="0" aria-label="Usage calendar. Scroll horizontally for daily use and reset history."><div class="history-rail-canvas"></div></div></div><div id="usage-calendar-footer">${calendarFooter()}</div></div>`;
}
function updateTimelineIdentity(){const identities=$('history-identities');if(identities)identities.innerHTML=timelineIdentityHTML();const footer=$('usage-calendar-footer');if(footer)footer.innerHTML=calendarFooter();}
function calendarStamp(value,options){return new Date(value).toLocaleString('en-US',{timeZone:calendarZone()||undefined,...options});}
function updateTodayControl(){
 const button=document.querySelector('[data-timeline-today]');if(button)button.style.visibility=timelineFollowToday?'hidden':'visible';
 const month=document.querySelector('.history-rail-month');if(month){const date=new Date(timelineFollowToday?now:timelineAnchor??now);month.textContent=calendarStamp(date,{month:'short'});month.setAttribute('data-title-tip',calendarStamp(date,{year:'numeric',month:'long'}));}
}
function saveTimelinePosition(){
 const viewport=$('reset-history-scroll');if(!viewport||!timelinePlan||timelineRestoring)return;
 timelineLastScroll=performance.now();
 timelineFollowToday=Math.abs(viewport.scrollLeft-railX(timelinePlan.home))<2;
 timelineAnchor=timelineFollowToday?null:railTime(viewport.scrollLeft);
 updateTodayControl();
}
function showTimelineToday(){
 timelineFollowToday=true;timelineAnchor=null;const viewport=$('reset-history-scroll');if(!viewport||!timelinePlan)return;
 timelineRestoring=true;viewport.scrollLeft=railX(timelinePlan.home);updateTodayControl();requestAnimationFrame(()=>timelineRestoring=false);
}
function calendarRateGuides(key){
 const provider=providerData(key),window=currentRows(key)[0];
 const current=window?NowUsage.dailyPaceGuides(window,{now,observedAt:provider.observedAt,status:provider.status}):[];
 const historical=archiveGroups(key).flatMap(record=>NowUsage.dailyPaceGuides({durationMinutes:10080,resetsAt:record.reset}));
 return [...historical,...current];
}
function calendarGuideHTML(plan,key,ceiling){
 const width=plan.days.length*plan.cell,from=plan.days[0].start,until=plan.days.at(-1).end;
 const guides=calendarRateGuides(key).filter(guide=>guide.until>from&&guide.from<until);
 const even=guides.filter(guide=>guide.kind==='even').sort((a,b)=>a.from-b.from),merged=[];
 for(const guide of even){const last=merged.at(-1);if(last&&guide.from<=last.until&&Math.abs(guide.dailyPercent-last.dailyPercent)<.000001)last.until=Math.max(last.until,guide.until);else merged.push({...guide});}
 const html=[...merged,...guides.filter(guide=>guide.kind==='catch-up')].map(guide=>{
  const x1=plan.x(Math.max(from,guide.from)),x2=plan.x(Math.min(until,guide.until)),offscale=guide.dailyPercent>ceiling;
  const y=Math.max(1,Math.min(29,30*(1-guide.dailyPercent/ceiling)));
  const label=(guide.kind==='even'?'Even pace':'Catch up from now')+': '+dailyNumber(guide.dailyPercent)+' percentage points per 24 hours'+(offscale?', above chart scale':'');
  return `<g data-guide-kind="${guide.kind}" data-guide-rate="${guide.dailyPercent}" data-guide-from="${guide.from}" data-guide-until="${guide.until}" data-offscale="${offscale}"><title>${esc(label)}</title><line class="${guide.kind}" x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/>${offscale?`<path class="catch-up" d="M${x2-5} 6l3-4 3 4"/>`:''}</g>`;
 }).join('');
 return `<svg class="calendar-pace-guides" viewBox="0 0 ${width} 30" preserveAspectRatio="none" role="img" aria-label="${P[key].name} daily budget rate guides, in percentage points per 24 hours">${html}</svg>`;
}
function showDailyPaceGuides(){
 const rates=Object.keys(P).map(key=>{const current=calendarRateGuides(key).filter(guide=>guide.kind==='catch-up').at(-1);return P[key].name+': '+(current?dailyNumber(current.dailyPercent)+' percentage points per 24 hours until '+calendarStamp(current.until,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.':'catch-up rate unavailable.');}).join(' ');
 tip('Daily budget pace','Dashed: one full allowance spread evenly over the reported week. Colored: remaining allowance spread over the time from now to reset. '+rates,'Both lines are rates per 24 hours on the same percentage-point scale as the bars. A bar is the amount observed during a local calendar day; today and 23/25-hour days have different lengths. Lines are budget references, not observed use or forecasts. Catch-up stops at reset and disappears without a fresh reading. An upward chevron means the catch-up rate exceeds the chart scale.');
}
function calendarDailyHTML(plan,key){
 const model=dailyModel(),series=model.series.find(row=>row.key===key);
 const days=(series?.days||[]).filter(row=>plan.days.some(bucket=>bucket.day===row.day));
 return `<div class="calendar-daily-bars" data-daily-chart="${key}" data-ceiling="${model.ceiling}" role="group" aria-label="${P[key].name}, daily percentage points of weekly allowance, 0 to ${model.ceiling}">${calendarGuideHTML(plan,key,model.ceiling)}${days.map(row=>`<button class="daily-bar ${row.state} ${row.today?'is-today':''} ${selectedDailyDay===row.day?'daily-selected':''}" style="left:${plan.x(row.day)}px;width:${plan.cell}px" data-daily-day="${row.day}" data-daily-vendor="${key}" aria-label="${esc(P[key].name+', '+row.day+', '+(row.points===null?'insufficient readings':dailyNumber(row.points)+' percentage points of weekly allowance'+(row.state==='partial'?', incomplete readings':''))+(row.today?', today so far':''))}"><span class="daily-bar-track">${row.points===null?'':row.points===0?'<i class="daily-zero"></i>':`<i class="daily-fill" style="height:${Math.min(100,row.points/model.ceiling*100)}%"></i>`}</span></button>`).join('')}</div>`;
}
function calendarMarkerHTML(marker){
 const key=marker.key,period=marker.window?.labelText||'weekly';
 let label=P[key].name+', reported reset '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+', last observed '+timelineValue(marker);
 if(marker.kind==='upcoming')label=P[key].name+', upcoming '+period+' reset, latest reported '+timelineValue(marker)+' used'+(marker.unavailable?' (last reading or unavailable)':'');
 if(marker.kind==='decrease')label=P[key].name+', observed allowance drop, '+timelineValue(marker)+', '+marker.events.length+' decrease'+(marker.events.length===1?'':'s')+' on this date';
 return `<button class="history-usage-marker ${marker.kind} ${marker.kind==='decrease'?'allowance-drop':''} ${marker.unavailable?'is-unavailable':''}" data-usage-history-marker="${esc(marker.id)}" data-marker-at="${esc(marker.reset)}" style="left:${railX(marker.reset)}px" aria-label="${esc(label)}"><span class="history-usage-point">${['recorded','upcoming'].includes(marker.kind)?NowUsage.resetMarker():''}</span><span class="history-usage-value">${esc(timelineValue(marker))}</span></button>`;
}
function mountHistoryRail(force=false){
 const viewport=$('reset-history-scroll');if(!viewport||!viewport.clientWidth)return;
 if(!force&&(timelinePointer||timelineLastScroll&&performance.now()-timelineLastScroll<180)){
  clearTimeout(timelineDeferred);timelineDeferred=setTimeout(()=>mountHistoryRail(),200);return;
 }
 const plan=createTimelinePlan(viewport.clientWidth);if(!plan){viewport.querySelector('.history-rail-canvas').innerHTML='<div class="daily-loading" role="status">Calendar timezone unavailable</div>';return;}timelinePlan=plan;
 const active=document.activeElement,focusedDay=active?.dataset.dailyDay,focusedVendor=active?.dataset.dailyVendor,focusedMarker=active?.dataset.usageHistoryMarker;
 const canvas=viewport.querySelector('.history-rail-canvas'),width=plan.days.length*plan.cell;
 canvas.style.width=width+'px';canvas.style.setProperty('--rail-cell',plan.cell+'px');
 const dateHTML=plan.days.map(bucket=>{const date=new Date(bucket.day+'T12:00:00Z');return `<span class="${bucket.day===plan.today?'is-today':''}" data-calendar-day="${bucket.day}" aria-label="${esc(date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}))}">${date.toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'}).slice(0,2)}<b>${date.getUTCDate()}</b></span>`;}).join('');
 const todayX=railX(plan.today),nowX=railX(now);
 canvas.innerHTML=`<div class="history-rail-dates">${dateHTML}</div>`+Object.keys(P).map(key=>{
  const source=document.querySelector(`.history-fixed-row[data-provider="${key}"]`),height=source?.getBoundingClientRect().height||76;
  const markers=Object.keys(P).flatMap(timelineMarkers).filter(marker=>marker.key===key);
  return `<div class="history-rail-lane" data-history-lane="${key}" style="height:${height}px;--color:${P[key].color}"><span class="history-day-shade" style="left:${todayX}px;width:${plan.cell}px"></span><span class="history-day-grid"></span><span class="history-now" style="left:${nowX}px"></span><span class="history-baseline"></span>${markers.map(calendarMarkerHTML).join('')}${calendarDailyHTML(plan,key)}</div>`;
 }).join('');
 const target=railX(timelineFollowToday?plan.home:timelineAnchor??plan.home);
 if(Math.abs(viewport.scrollLeft-target)>1){timelineRestoring=true;viewport.scrollLeft=target;requestAnimationFrame(()=>timelineRestoring=false);}
 if(!viewport.dataset.ready){
  viewport.dataset.ready='true';
  viewport.addEventListener('scroll',()=>{saveTimelinePosition();placeCalendarLabels();if(!timelineKeyboardDetail)closeTip();},{passive:true});
  viewport.addEventListener('pointerdown',()=>{timelinePointer=true;timelineKeyboardDetail=false;},{passive:true});
  viewport.addEventListener('keydown',event=>{
   if(event.target.closest('[data-daily-day]')||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();timelineKeyboardDetail=false;
   if(event.key==='Home')viewport.scrollLeft=0;
   else if(event.key==='End')showTimelineToday();
   else viewport.scrollLeft+=(event.key==='ArrowRight'?1:-1)*timelinePlan.cell;
  });
 }
 if(focusedDay)[...viewport.querySelectorAll('[data-daily-day]')].find(button=>button.dataset.dailyDay===focusedDay&&button.dataset.dailyVendor===focusedVendor)?.focus({preventScroll:true});
 if(focusedMarker)[...viewport.querySelectorAll('[data-usage-history-marker]')].find(button=>button.dataset.usageHistoryMarker===focusedMarker)?.focus({preventScroll:true});
 placeCalendarLabels();updateTodayControl();
}
function placeCalendarLabels(){
 const rail=$('reset-history-scroll');if(!rail)return;
 for(const lane of rail.querySelectorAll('.history-rail-lane')){
  const visible=[];
  for(const marker of lane.querySelectorAll('.history-usage-marker')){
   const center=parseFloat(marker.style.left)-rail.scrollLeft,label=marker.querySelector('.history-usage-value');if(!label)continue;
   let leader=marker.querySelector('.history-label-leader');
   if(!leader){leader=document.createElement('span');leader.className='history-label-leader';leader.setAttribute('aria-hidden','true');marker.prepend(leader);}
   label.style.visibility='hidden';leader.hidden=true;
   if(center<0||center>rail.clientWidth)continue;
   const width=label.getBoundingClientRect().width;
   visible.push({marker,label,leader,center,width,left:Math.max(2,Math.min(rail.clientWidth-width-2,center-width/2))});
  }
  visible.sort((a,b)=>a.center-b.center);
  let edge=2;
  for(const row of visible){row.left=Math.max(row.left,edge);edge=row.left+row.width+4;}
  edge=rail.clientWidth-2;
  for(const row of [...visible].reverse()){row.left=Math.min(row.left,edge-row.width);edge=row.left-4;}
  edge=2;
  for(const row of visible){
   // Dense histories keep every marker tappable; labels that cannot fit are disclosed on tap.
   if(row.left<edge||row.left+row.width>rail.clientWidth-2)continue;
   const delta=row.left+row.width/2-row.center;
   row.label.style.visibility='visible';row.label.style.transform='translateX(calc(-50% + '+delta+'px))';edge=row.left+row.width+4;
   if(Math.abs(delta)>4){row.leader.hidden=false;row.leader.style.width=Math.hypot(delta,10)+'px';row.leader.style.transform='rotate('+Math.atan2(-10,delta)+'rad)';}
  }
 }
}
function showAllowanceDrop(marker){
 const events=[...marker.events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const body=events.map(event=>dailyNumber(event.before)+'% → '+dailyNumber(event.after)+'% used ('+dailyNumber(event.drop)+' percentage points lower), observed between '+calendarStamp(event.before_at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' and '+calendarStamp(event.at,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.').join(' ');
 const related=(HISTORY.adjustments||[]).filter(row=>row.provider===marker.key&&row.bucket==='seven_day_fable'&&events.some(event=>Date.parse(row.at)===Date.parse(event.at)));
 const confirmed=events.filter(event=>event.confirmed_restore);
 const notes=(confirmed.length?'You identified this observed drop as a '+confirmed[0].restore_label+' reset. Daily counting resumes from the lower observed reading without subtracting the restored allowance from prior consumption. The unobserved part of the reset interval remains unknown. ':'')+(related.length?'Fable also fell in the same observation: '+related.map(row=>dailyNumber(row.before)+'% → '+dailyNumber(row.after)+'%').join(', ')+'. ':'')+'The scheduled reset stayed within the same reporting window. '+(confirmed.length?'The reset classification comes from your report, not a provider event record. ':'The saved readings do not identify a button press or the reason for the decrease. Daily totals remain conservative while a counter is below its earlier peak; a manual restore can therefore leave consumption uncounted. ')+'The diamond marks the first lower reading, not an exact action time. '+(events.length>1?'The calendar label shows the largest drop on this date. ':'')+'Times follow '+calendarZone()+'.';
 tip(P[marker.key].name+' · observed allowance drop',body,notes);
}
function showUpcomingUsage(marker){
 const provider=providerData(marker.key),window=marker.window;
 const body=marker.value===null?'A current allowance reading is unavailable.':dailyNumber(marker.value)+'% of the '+(window?.durationMinutes===300?'five-hour':'weekly')+' allowance reported used.';
 tip(P[marker.key].name+' · upcoming reset',body+' Resets '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'.',(marker.unavailable?'This value is unavailable or from an older reading. ':'')+(provider.observedAt?'Observed '+calendarStamp(provider.observedAt,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. ':'')+'The percentage is the latest reported use, shown against its upcoming reset. It is not a forecast of final usage. The multiplier beside the vendor name gives the available pace for the remaining period.');
}
function showAvailablePace(marker){
 const pace=marker.pace,period=marker.window?.labelText||'Allowance';
 const title=P[marker.key].name+' · '+period+' available pace';
 if(!pace){tip(title,'Available pace unavailable','A fresh usage reading, a known period length and a future reset time are required. No rate is guessed from stale or unknown windows.');return;}
 const hourly=marker.window.durationMinutes<1440,normal=pace.normalDailyPercent/(hourly?24:1),available=pace.availableDailyPercent/(hourly?24:1),unit=hourly?'hour':'day';
 tip(title,paceLabel(pace.multiplier)+' the normal even pace until '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. '+dailyNumber(pace.remainingPercent)+'% of the allowance and '+dailyNumber(pace.remainingFraction*100)+'% of the period remain.','Remaining allowance ÷ remaining time, relative to one full allowance over one full period. Normal pace is '+dailyNumber(normal)+' percentage points per '+unit+'; the remaining budget permits '+dailyNumber(available)+' per '+unit+'. Halfway through an unused week, 100% ÷ 50% = 2×. This is available capacity, not a prediction of what you will use. Future resets or credits are not assumed.');
}
function showUsageHistoryMarker(id){
 const marker=Object.keys(P).flatMap(timelineMarkers).find(marker=>marker.id===id);if(!marker)return;
 if(marker.kind==='decrease'){showAllowanceDrop(marker);return;}
 if(marker.kind==='upcoming'){showUpcomingUsage(marker);return;}
 const title=P[marker.key].name+' · reported reset '+calendarStamp(marker.reset,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 if(marker.kind==='recorded'){
   const peak=Number.isFinite(marker.peak)&&marker.peak>marker.value?'Peak observed '+marker.peak+'%. ':'';
  const gap=(Date.parse(marker.reset)-Date.parse(marker.last))/60000;
  const missing=gap<1?'less than a minute':gap<60?Math.round(gap)+' minutes':Math.round(gap/60)+' hours';
  tip(title,marker.value+'% last observed '+calendarStamp(marker.last,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),peak+'Reading was '+missing+' before reset. Final usage is not supplied. '+marker.revisions+' reported reset timestamps grouped on this date.');
 }else if(marker.forecast?.restored){
  tip(title,'About '+Math.round(marker.value)+'% at the pace observed since the confirmed restore. Current reported use '+marker.forecast.used+'%.','The estimate starts from '+marker.forecast.baseline+'% at the first lower reading '+calendarStamp(marker.forecast.since,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+'. Earlier credited usage is not treated as current consumption. Actual usage can change.');
 }else if(marker.forecast){
  tip(title,'About '+Math.round(marker.value)+'% at the current average pace. Reported use '+marker.forecast.used+'% after '+Math.round(marker.forecast.elapsed)+'% of the period.','Linear estimate since the reported period began. Actual usage can change.');
 }else tip(title,'Projection unavailable','A fresh reading and enough elapsed time in this period are required.');
}
const shortNumber=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value);
const dailyDate=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const dailyNumber=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
function dailyModel(){
 const raw=HISTORY.dailyAllowance,validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day);
 const dates=Array.isArray(raw?.days)?[...new Set(raw.days.filter(validDay))].sort():[];
 const series=Object.keys(P).map(key=>{
  const source=raw?.providers?.find(row=>row.provider===key),byDay=new Map((source?.days||[]).map(row=>[row.day,row]));
  const days=dates.map(day=>{
   const row=byDay.get(day),points=Number.isFinite(row?.points)&&row.points>=0?row.points:null;
   return {...row,day,points,state:points===null?'missing':row.state==='observed'?'observed':'partial'};
  });
  return {key,days,firstAt:source?.firstAt,lastAt:source?.lastAt};
 });
 const rateMaximum=Math.max(0,...Object.keys(P).flatMap(calendarRateGuides).map(guide=>Math.min(100,guide.dailyPercent)));
 const maximum=Math.max(rateMaximum,...series.flatMap(row=>row.days.map(day=>day.points||0)));
 const ceiling=maximum>20?Math.ceil(maximum/10)*10:maximum>10?20:10;
 return {dates,series,ceiling,timezone:raw?.timezone||'Laptop local time',updatedAt:raw?.updatedAt};
}
function rawTokenSummary(key){
 const rows=HISTORY.tokenDays.filter(row=>row.provider===key&&Number.isFinite(row.tokens)&&row.tokens>=0).sort((a,b)=>a.day.localeCompare(b.day)),latest=rows.at(-1);
 if(!latest)return 'Raw daily token totals are not connected for '+P[key].name+'.';
 return 'Separate raw token record: '+latest.tokens.toLocaleString('en-US')+' tokens on '+dailyDate(latest.day)+', '+latest.day.slice(0,4)+(key==='claude'?' UTC. Retained laptop Claude Code logs only; cloud and other devices are excluded.':' (provider-reported account date). Raw token totals are not used in these allowance bars.');
}
function showDailyDay(key,day){
 const model=dailyModel(),series=model.series.find(row=>row.key===key),row=series?.days.find(row=>row.day===day);if(!row)return;
 selectedDailyDay=day;document.querySelectorAll('[data-daily-day]').forEach(button=>button.classList.toggle('daily-selected',button.dataset.dailyDay===day));
 const title=P[key].name+' · '+dailyDate(day)+', '+day.slice(0,4)+(row.today?' · so far':'');
 const body=row.points===null?'Daily use unavailable: insufficient comparable readings.':(row.estimated?'About ':'')+dailyNumber(row.points)+'% of a weekly allowance observed'+(row.state==='partial'?' in the measured portions of this day.':' during this day.');
 const reasonNames={'allowance-restored':'A confirmed allowance restore established a new observed baseline. The restore interval remains uncertain.','overnight-gap':'A long gap crosses dates, so its increase was not divided between days.','reset-tail':'The final portion before a reset was not observed.','reported-decrease':'Reported use fell during the same allowance period. A restore or provider revision can cause this. Usage below the earlier peak is not counted again, so the total may omit new consumption after a manual restore.','correction-recovery':'A revised counter was kept from being counted twice.','period-change':'The provider changed the reported allowance period.','bucket-change':'The provider changed the weekly usage counter.'};
 const notes=[...new Set((row.reasons||[]).map(reason=>reasonNames[reason]).filter(Boolean))];
 if(row.points!==null)notes.unshift('Usable readings cover '+Math.round((row.coverage||0)*100)+'% of '+(row.today?'today so far':'this day')+'.');
 if(row.unallocated>0)notes.push(dailyNumber(row.unallocated)+' percentage points rose across a gap spanning multiple dates; that rise is not assigned to an individual day.');
 if(row.estimated)notes.push('An increase across midnight was split by elapsed time between nearby readings.');
 if(row.resets)notes.push('A weekly reset occurred on this day.');
 if(row.restores)notes.push(row.restores+' confirmed restore'+(row.restores===1?'':'s')+' lowered the reported counter by '+dailyNumber(row.restoredPoints||0)+' percentage points. That decrease is not negative consumption.');
 notes.push('Days follow '+model.timezone+'.');
 tip(title,body,notes.join(' '));
} function remainingCaption(reset){
  const minutes=Math.ceil((Date.parse(reset)-now)/60000);
  if(!Number.isFinite(minutes))return 'Reset unknown';
  if(minutes<=0)return 'Awaiting reset';
  if(minutes<60)return 'In '+minutes+'m';
  if(minutes<1440)return 'In '+Math.floor(minutes/60)+'h '+minutes%60+'m';
  return 'In '+Math.floor(minutes/1440)+'d '+Math.floor(minutes%1440/60)+'h';
 }
 function currentAccounts(){
  return Object.keys(P).map(key=>{
   const row=currentRows(key)[0],provider=providerData(key),unknown=!row||row.usedPercent===null,old=stale(key),due=row&&expired(row);
   const value=unknown||due?'—':pc(row)+'%',reset=row?.resetsAt;
   const resetDate=reset?calendarStamp(reset,{weekday:'short',hour:'numeric',minute:'2-digit'}):'Reset unknown';
   const label=P[key].name+', '+(unknown?'weekly reading unavailable':due?'awaiting a new reset reading':dailyNumber(row.usedPercent)+'% of weekly allowance used'+(old?', saved reading':''))+'. '+(reset?'Resets '+resetDate+'. ':'')+'Open all allowance details.';
   return `<button class="pu-account ${old||due?'is-stale':''}" data-allowance-provider="${key}" aria-label="${esc(label)}" style="--account-color:${P[key].color}"><span class="pu-account-name">${mark(key)}${P[key].name}</span><span class="pu-account-value">${value}${old&&!unknown&&!due?'<small>last</small>':''}</span>${row?meter(key,row):'<span class="quota-bar unavailable" aria-hidden="true"></span>'}<span class="pu-reset-date">${esc(resetDate)}</span><span class="pu-reset-left">${esc(reset?remainingCaption(reset):provider.status==='available'?'No weekly limit reported':'Not connected')}</span></button>`;
  }).join('');
 }
 function timelineIdentityHTML(){
  return Object.keys(P).map(key=>{
   const row=currentRows(key)[0],pace=availablePace(key,row),label=pace?paceLabel(pace.multiplier):'—';
   return `<section class="history-fixed-row" data-provider="${key}"><div class="calendar-identity"><button class="timeline-provider" data-allowance-provider="${key}" aria-label="${P[key].name} allowance details" style="color:${P[key].color}">${mark(key)}<span>${P[key].name}</span></button><button class="calendar-pace ${pace?'':'is-unavailable'}" data-available-pace="${key}" aria-label="${P[key].name}, catch up at ${esc(label)} relative to normal weekly pace"><span class="calendar-pace-label">Catch up at:</span><span class="calendar-pace-value">${esc(label)}</span></button></div></section>`;
  }).join('');
 }
 function showDetail(title,body){
  window.NowPhoneInfo?.open({anchor:detailAnchor||document.activeElement,title,body:`<div class="[&_.pu-note]:text-xs [&_.pu-note]:leading-5 [&_.pu-note]:text-stone-500">${body}</div>`});
 }
 function closeTip(){window.NowPhoneInfo?.close();}
 function tip(title,body,sub=''){showDetail(title,`<p>${esc(body)}</p>${sub?`<p class="pu-note">${esc(sub)}</p>`:''}`);}
 function showProviderDetails(key){
  if(!P[key])return;
  showDetail(P[key].name+' allowances',NowUsage.render(DATA.providers,{provider:key,now})+`<p class="pu-note">${esc(rawTokenSummary(key))}</p>`);
 }
 function adaptedItems(){
  return (snapshot?.items||[]).map(item=>({key:String(item.provider||'').toLowerCase(),identity:item.key,id:item.id,kind:item.kind,title:item.title,state:item.state,
   at:Date.parse(item.at),place:String(item.location||'').toLowerCase(),sessionUrl:item.sessionUrl,url:item.url}));
 }
 function cacheRows(){return window.NowRecentUsage?.select(adaptedItems(),HISTORY.sessionUsage,{now})||[];}
 function setHTML(node,text){if(node&&node._usageHTML!==text){node.innerHTML=text;node._usageHTML=text;}}
 function render(){
  host=$('usage');if(!host||rendering||!window.NowUsage)return;rendering=true;
  const scroll=window.NowViews?.scrollPosition?.('usage')??host.scrollTop,focus=document.activeElement;
  const focusKey=focus?.dataset.recentSession||focus?.dataset.allowanceProvider||focus?.dataset.availablePace;
  const focusType=focus?.dataset.recentSession?'recent-session':focus?.dataset.allowanceProvider?'allowance-provider':focus?.dataset.availablePace?'available-pace':'';
  now=Date.now();
  try{
   if(!host.querySelector('.pu-shell')){
    host.innerHTML=`<div class="pu-shell"><section class="pu-current" aria-label="Current weekly allowances"><h2>Weekly allowances</h2><div class="pu-accounts"></div></section>${NowUsage.workspace({timeline:rowChart()})}<div id="usage-recent-sessions"></div></div>`;
   }
   const shell=host.querySelector('.pu-shell');if(!shell.dataset.utilities){shell.classList.add(...usageUtilities);shell.dataset.utilities='true';}
   setHTML(host.querySelector('.pu-accounts'),currentAccounts());
   updateTimelineIdentity();
   setHTML($('usage-recent-sessions'),window.NowRecentUsage?.render(cacheRows(),{now})||'');
   const footer=$('usage-calendar-footer');
   if(footer&&archiveSaved)footer.insertAdjacentHTML('beforeend','<p class="pu-saved">Saved history · '+esc(new Date(HISTORY.updatedAt).toLocaleString())+'</p>');
   if(focusType&&!focus.isConnected)[...host.querySelectorAll('[data-'+focusType+']')].find(node=>node.getAttribute('data-'+focusType)===focusKey)?.focus({preventScroll:true});
   requestAnimationFrame(()=>mountHistoryRail());
   if(window.NowViews?.scrollTo)window.NowViews.scrollTo(scroll,'usage');else if(host.scrollTop!==scroll)host.scrollTop=scroll;
  }finally{rendering=false;}
 }
 function validArchive(value){
  return value?.schemaVersion===1&&Array.isArray(value.periods)&&value.periods.length<=20000&&Array.isArray(value.tokenDays)&&value.tokenDays.length<=100000
   &&Number.isFinite(Date.parse(value.updatedAt))&&(!value.dailyAllowance||Array.isArray(value.dailyAllowance.days)&&Array.isArray(value.dailyAllowance.providers));
 }
 function restoreHistory(){
  try{const text=localStorage.getItem(HISTORY_KEY);if(!text||text.length>MAX_HISTORY)return;const saved=JSON.parse(text);if(validArchive(saved)){HISTORY=saved;archiveLoaded=true;archiveSaved=true;}}
  catch{/* Browser storage is optional. */}
 }
 async function refresh(){
  if(archiveBusy||document.hidden)return;archiveBusy=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch('/api/v1/usage-history',{cache:'no-store',signal:controller.signal});
   if(response.status===403){HISTORY=emptyHistory();archiveLoaded=false;archiveSaved=false;try{localStorage.removeItem(HISTORY_KEY);}catch{}return;}
   if(!response.ok||Number(response.headers.get('content-length'))>MAX_HISTORY)throw Error('Unavailable');
   const text=await response.text();if(text.length>MAX_HISTORY)throw Error('Oversized history');
   const value=JSON.parse(text);if(!validArchive(value))throw Error('Invalid history');
   HISTORY=value;archiveLoaded=true;archiveSaved=false;
   try{localStorage.setItem(HISTORY_KEY,text);}catch{}
   window.dispatchEvent(new CustomEvent('nowusagearchivechange'));
  }catch{archiveSaved=archiveLoaded;}
  finally{clearTimeout(timer);archiveBusy=false;archiveAttempted=true;render();}
 }
 function update(value){snapshot=value;DATA.providers=Array.isArray(value?.usage)?value.usage:[];render();}
 document.addEventListener('click',event=>{
  if(!event.target.closest('#usage'))return;
  detailAnchor=event.target.closest('button');
  try{
  const provider=event.target.closest('[data-allowance-provider]');if(provider){showProviderDetails(provider.dataset.allowanceProvider);return;}
  const session=event.target.closest('[data-recent-session]');
  if(session&&!event.metaKey&&!event.ctrlKey&&!event.altKey&&!event.shiftKey){event.preventDefault();window.NowPhone?.openSession(session.dataset.recentSession);return;}
  const pace=event.target.closest('[data-available-pace]');if(pace){const key=pace.dataset.availablePace,row=currentRows(key)[0];showAvailablePace({key,window:row,pace:availablePace(key,row),reset:row?.resetsAt});return;}
  const marker=event.target.closest('[data-usage-history-marker]');if(marker){showUsageHistoryMarker(marker.dataset.usageHistoryMarker);return;}
  const day=event.target.closest('[data-daily-day]');if(day){showDailyDay(day.dataset.dailyVendor,day.dataset.dailyDay);return;}
  if(event.target.closest('[data-timeline-today]')){showTimelineToday();return;}
  if(event.target.closest('[data-pace-guide-info]')){showDailyPaceGuides();return;}
  if(event.target.closest('[data-daily-info]')){tip('Daily allowance use','Bars show percentage points of weekly allowance consumed on each date. All three vendors share the same scale.','Hatching marks incomplete readings. Striped empty slots lack sufficient readings. Today is unfinished. Unknown gaps and reset tails are not guessed.');return;}
  const cacheInfo=event.target.closest('[data-cache-info]');if(cacheInfo){const kind=cacheInfo.dataset.cacheInfo;tip(kind==='context'?'Recorded context':kind==='left'?'Activity window':'Claude one-hour cache window',kind==='context'?'Last recorded input context, including cached tokens. Context size can predate the latest activity.':kind==='left'?'Minutes remaining until one hour after the session’s last observed activity. Shading uses that same clock.':window.NowRecentUsage.INFO,'Recent activity does not confirm that a prompt cache remains available. Open Web Tools Usage for deeper token and cache analysis.');return;}
  if(event.target.closest('[data-timeline-info]'))tip('Usage and resets','Colored reset arrows show the last saved percentage before reset. Gray arrows show current reported use against the next reset. Diamonds mark observed counter drops.','Daily bars measure percentage points of weekly allowance. The catch-up multiplier is available capacity for the remaining time, not a prediction. Dates follow '+calendarZone()+'.'); }finally{detailAnchor=null;}
 });
 document.addEventListener('keydown',event=>{
  const button=event.target.closest('#usage [data-daily-day]');if(!button||event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();
  const items=[...button.closest('[data-daily-chart]').querySelectorAll('[data-daily-day]')],index=items.indexOf(button);
  const next=event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowRight'?1:-1)));
  items[next].focus({preventScroll:true});timelineKeyboardDetail=true;
  const rail=$('reset-history-scroll'),target=railX(items[next].dataset.dailyDay);
  if(target<rail.scrollLeft)rail.scrollLeft=target;else if(target+timelinePlan.cell>rail.scrollLeft+rail.clientWidth)rail.scrollLeft=target+timelinePlan.cell-rail.clientWidth;
  showDailyDay(items[next].dataset.dailyVendor,items[next].dataset.dailyDay);
 });
 window.addEventListener('pointerup',()=>timelinePointer=false);
 window.addEventListener('pointercancel',()=>timelinePointer=false);
 window.addEventListener('resize',()=>requestAnimationFrame(()=>mountHistoryRail(true)));
 window.addEventListener('nowviewchange',()=>{closeTip();if(window.NowViews?.current()==='usage')requestAnimationFrame(render);});
 window.addEventListener('pageshow',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();refresh();}});
 window.NowPhoneUsage={update,refresh,sessionUsage:()=>archiveSaved?{...HISTORY.sessionUsage,available:false}:HISTORY.sessionUsage||{},recentRows:cacheRows,
  state:()=>({archiveLoaded,archiveSaved,archiveAttempted,updatedAt:HISTORY.updatedAt,followingToday:timelineFollowToday,anchor:timelineAnchor}),showProvider:showProviderDetails};
 restoreHistory();render();refresh();
 setInterval(refresh,60000);
 setInterval(()=>{if(!document.hidden)render();},30000);
})();
