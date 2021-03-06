/* See license.txt for terms of usage */

var Firebug = Firebug || {};

// ********************************************************************************************* //

/**
 * Returns default configuration object for Firebug module loader (RequireJS). Custom
 * value can be passed through the argument.
 *
 * @param {Object} baseConfig Custom configuration values.
 */
Firebug.getModuleLoaderConfig = function(baseConfig)
{
    baseConfig = baseConfig || {};

    // Set configuration defaults.
    baseConfig.baseLoaderUrl = baseConfig.baseLoaderUrl || "resource://moduleLoader/";
    baseConfig.prefDomain = baseConfig.prefDomain || "extensions.firebug";
    baseConfig.baseUrl = baseConfig.baseUrl || "resource://";
    baseConfig.xhtml = true;  // createElementNS used
    baseConfig.arch = baseConfig.arch || "chrome://firebug/content/bti/inProcess";

    baseConfig.paths = baseConfig.paths || {
        "arch": baseConfig.arch,
        "firebug": "chrome://firebug/content"
    };

    var config = {};
    var keys = Object.keys(baseConfig);
    keys.forEach(function copy(key)
    {
        config[key] = baseConfig[key];
    });

    // This is the basic list of necessary modules. All the other modules will be
    // automatically loaded as dependencies.
    config.modules = [
        "firebug/trace/traceModule",
        "firebug/chrome/navigationHistory",
        "firebug/chrome/knownIssues",
        "firebug/js/sourceFile",
        "firebug/chrome/shortcuts",
        "firebug/firefox/start-button/startButtonOverlay",
        "firebug/firefox/external-editors/externalEditors",
        "firebug/firefox/firebugMenu",
        "firebug/chrome/panelActivation",
        "firebug/console/memoryProfiler",
        "firebug/chrome/tableRep",
        "firebug/html/htmlPanel",
        "firebug/console/commandLinePopup",
        "firebug/accessible/a11y",
        "firebug/js/scriptPanel",
        "firebug/js/callstack",
        "firebug/console/consoleInjector",
        "firebug/net/spy",
        "firebug/js/tabCache",
        "firebug/chrome/activation",
        "firebug/css/cssComputedElementPanel",
    ];

    return config;
}

// ********************************************************************************************* //
// Firebug Extension Registration

Firebug.extensions = {};

/**
 * Registers a Firebug extension. The framework automatically loads 'main' extension
 * module (AMD).
 *
 * @param {String} extName        Unique name of the extension. This name is used to
 *      build chrome paths for extension resource: chrome://<ext-id>/content/main.js
 * @param {Object} extConfig    Configuration file
 */
Firebug.registerExtension = function(extName, extConfig)
{
    extConfig = extConfig || {};

    var tempConfig = this.getExtensionConfig(extName);
    if (tempConfig)
    {
        FBTrace.sysout("firebug.registerExtension; ERROR An extenstion with the same ID " +
            "already exists! - " + extName, tempConfig);
        return;
    }

    if (FBTrace.DBG_REGISTRATION)
        FBTrace.sysout("Extension registered: " + extName);

    this.extensions[extName] = extConfig;

    var config = Firebug.getModuleLoaderConfig();

    // Do not use resource: protocol for extensions (it's not allowed for bootstrapped
    // extensions to specify the protocol in chrome.manifest and it would require
    // additional code in every extension (in bootstrap.js), use standard chrome: instead.
    //config.paths[extName] = extName + "/content";
    config.paths[extName] = "chrome://" + extName + "/content";

    // Load main.js module (the entry point of the extension) and support for tracing.
    // All other extension modules should be loaded within "main" module.
    Firebug.require(config, [
        extName + "/main",
        "firebug/lib/trace"
    ],
    function(Extension, FBTrace)
    {
        try
        {
            extConfig.app = Extension;

            // Extension intialization procedure should be within this method (in main.js).
            if (Extension.initialize)
                Extension.initialize();

            // Refresh Firebug tab-bar to make sure that any new registered panels
            // are displayed.
            Firebug.chrome.syncMainPanels();

            if (FBTrace.DBG_INITIALIZE)
                FBTrace.sysout("firebug.main; Extension '" + extName + " - modules loaded!");
        }
        catch (err)
        {
            if (FBTrace.DBG_ERRORS || FBTrace.DBG_REGISTRATION)
                FBTrace.sysout("firebug.main; Extension: " + extName + " EXCEPTION " + err, err);
        }
    });
}

/**
 * Unregisters and shutdowns specific extension. Registered extensions are unregistered
 * automatically when Firebug shutdowns. Bootstrapped extensions should use this method
 * to dynamically uninstall an extension.
 *
 * @param {Object} extName    ID of the extensions that should be unregistered.
 */
Firebug.unregisterExtension = function(extName)
{
    var extConfig = this.getExtensionConfig(extName);
    if (!extConfig)
        return;

    try
    {
        if (extConfig.app && extConfig.app.shutdown)
            extConfig.app.shutdown();

        delete this.extensions[extName];

        if (FBTrace.DBG_REGISTRATION)
            FBTrace.sysout("Extension unregistered: " + extName);
    }
    catch (err)
    {
        if (FBTrace.DBG_ERRORS || FBTrace.DBG_REGISTRATION)
            FBTrace.sysout("unregisterExtension: " + extName + " EXCEPTION " + err, err);
    }
}

Firebug.getExtensionConfig = function(extName)
{
    return this.extensions[extName];
}

Firebug.iterateExtensions = function(callback)
{
    for (var ext in this.extensions)
        callback(ext, this.extensions[ext]);
}

/**
 * Unregisters and shutdowns all registered extensions. Called by the framework when
 * Firebug shutdowns.
 */
Firebug.unregisterExtensions = function()
{
    var extensions = {};
    for (var p in this.extensions)
        extensions[p] = this.extensions[p];

    for (var extName in extensions)
        this.unregisterExtension(extName);

    this.extensions = {};
}

// ********************************************************************************************* //
