# Layout Attitude
The layout attitude provides a convenient way, to wrap whatever page is served, into an _html layout_. It does not wrap anything on its own. All it does is look out for `layout.something.html|hbs` and create a template function from it. Uses handlebars per default. The resulting template function is made available via `page.getLayout()` and can be used in subsequent attitudes to wrap a page when it is served.

[Goto file in Repository](https://github.com/kommander/aden/tree/master/attitudes/layout)
