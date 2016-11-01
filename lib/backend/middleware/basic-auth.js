// TODO: set middleware in .aden as object and hand over options to page middleware setup
const adenPageConfig = {
  middleware: {
    'basic-auth': {
      user: 'name',
      password: 'secret',
      users: [
        { name, password },
      ],
    },
  },
};
